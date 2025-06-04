import { FieldValue, WriteBatch } from "firebase-admin/firestore";
import { Dict, Mapping, Multiple, Optional, Shape } from "@ddd-ts/shape";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { AutoSerializer, EventReference } from "@ddd-ts/core";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";
import { EventId, IEsEvent } from "@ddd-ts/core";
import { IdMap } from "../../idmap";
import { FirestoreProjectedStreamReader } from "../../firestore.projected-stream.reader";
import { AccountCashflowProjection } from "../cashflow";
import { CheckpointId } from "../checkpoint-id";
import { Lock } from "../lock";
import { StableEventId } from "../write";
import { Cursor, EventStatus, ProcessingStartedAt } from "./shared";
import { wait } from "../tools";

class Task extends Shape({
  cursor: Cursor,
  lock: Lock,
}) {}

class EventIds extends Multiple(EventId) {
  firstIs(eventId: EventId) {
    return this.value[0]?.equals(eventId);
  }
}

class Claims extends IdMap(EventId, EventIds) {
  getClaimed(eventId: EventId) {
    const claimed: EventId[] = [];
    for (const [claimId, claimers] of this.entries()) {
      if (claimers.firstIs(eventId)) {
        claimed.push(claimId);
      }
    }
    return claimed;
  }
}

class Checkpoint extends Shape({
  id: CheckpointId,
  tail: Optional(Cursor),
  tasks: IdMap(EventId, Task),
  statuses: IdMap(EventId, EventStatus),
  claims: Claims,
}) {
  getClaimed(eventId: EventId) {
    const ids = this.claims.getClaimed(eventId);
    return ids
      .map((id) => this.tasks.get(id)?.cursor)
      .filter(Boolean)
      .sort((a, b) => (a?.isAfter(b!) ? 1 : -1)) as Cursor[];
  }

  static initial(id: CheckpointId) {
    return new Checkpoint({
      id,
      tail: undefined,
      tasks: IdMap.for(EventId, Dict({ cursor: Cursor, lock: Lock })),
      statuses: IdMap.for(EventId, EventStatus),
      claims: new Claims(),
    });
  }

  countProcessing() {
    console.log(this.serialize());
    const claimed = [...this.claims.keys()];

    const done = claimed.filter((id) => !this.statuses.get(id)?.is("done"));

    return done.length;
  }

  sortedTasks() {
    return [...this.tasks.values()].sort((a, b) =>
      a.cursor.isAfter(b.cursor) ? 1 : -1,
    );
  }

  getHead() {
    const tasks = this.sortedTasks();
    return tasks.length > 0 ? tasks.at(-1)?.cursor : this.tail;
  }

  shouldEnqueue(cursor: Cursor) {
    if (this.getHead()?.isAfterOrEqual(cursor)) {
      return false;
    }
    return true;
  }

  hasCompleted(cursor: Cursor) {
    if (this.tasks.has(cursor.eventId)) {
      return this.statuses.get(cursor.eventId)?.is("done");
    }
    return this.tail?.isAfterOrEqual(cursor) ?? false;
  }

  clean() {
    const tasks = [...this.tasks.values()].sort((a, b) =>
      a.cursor.isAfter(b.cursor) ? 1 : -1,
    );
    for (const task of tasks) {
      if (this.tail && task.cursor.isBefore(this.tail)) {
        this.tasks.delete(task.cursor.eventId);
        this.statuses.delete(task.cursor.eventId);
        this.tail = task.cursor;
        continue;
      }

      const status = this.statuses.get(task.cursor.eventId);

      if (status?.is("done")) {
        this.tasks.delete(task.cursor.eventId);
        this.statuses.delete(task.cursor.eventId);
        this.tail = task.cursor;
      }
    }
  }

  startNextBatch() {
    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];
    const batch: Cursor[] = [];

    const tasks = this.sortedTasks();

    for (const task of tasks) {
      if (this.tail && task.cursor.isBefore(this.tail)) {
        console.warn(
          `Skipping task ${task.cursor.eventId.serialize()} as it is before the tail ${this.tail?.eventId.serialize()}`,
        );
      }

      if (locks.some((lock) => lock.restrains(task.lock))) {
        locks.push(task.lock);
        continue;
      }

      if (batchLocks.some((lock) => lock.restrains(task.lock, false))) {
        locks.push(task.lock);
        continue;
      }

      const status = this.statuses.get(task.cursor.eventId);

      if (this.claims.has(task.cursor.eventId)) {
        locks.push(task.lock);
        continue;
      }

      if (status?.is("processing") || status?.is("done")) {
        locks.push(task.lock);
        continue;
      }

      batch.push(task.cursor);
      batchLocks.push(task.lock);

      this.statuses.set(task.cursor.eventId, EventStatus.processing());
    }

    return batch;
  }
}

export function max(n: number) {
  const incr = FieldValue.increment(n);

  //@ts-ignore
  //@ts-ignore
  incr.toProto = (serializer: any, fieldPath: any) => ({
    fieldPath: fieldPath.formattedName,
    maximum: { integerValue: n },
  });

  return incr;
}

class Projector {
  constructor(
    public readonly projection: AccountCashflowProjection,
    public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
    public readonly store: CheckpointStore,
    public readonly transaction: FirestoreTransactionPerformer,
  ) {}

  async enqueue(e: IEsEvent): Promise<boolean> {
    const checkpointId = this.projection.getShardCheckpointId(e as any);
    // this actually makes it work with large batches lmao ✓ HeavyHandleConcurrency (10935 ms)
    await wait(Math.random() * 100 + 100);
    const accountId = e.payload.accountId.serialize();
    const until = (e as any).ref;

    await this.store.initialize(checkpointId);
    const state = await this.store.expected(checkpointId);

    const cursor = Cursor.from(e);

    if (!state.shouldEnqueue(cursor)) {
      console.log(`Skipping ${e.id.serialize()} has already been enqueued`);
      return false;
    }

    const events = await this.reader.slice(
      this.projection.source,
      accountId,
      state.getHead()?.ref,
      until,
    );

    await this.transaction
      .perform(async (trx) => {
        for (const event of events) {
          const lock = this.projection.handlers[event.name].locks(event as any);
          await this.store.enqueue(checkpointId, event, lock, trx);
        }
      })
      .catch((e) => {
        throw new Error(
          `Failed to enqueue events for checkpoint ${checkpointId.serialize()}: ${e.message}`,
        );
      });

    return false;
  }

  async process(event: IEsEvent): Promise<any> {
    console.log(`Projector: processing event ${event.toString()}`);
    const checkpointId = this.projection.getShardCheckpointId(event as any);

    const state = await this.store.expected(checkpointId);

    if (state.hasCompleted(Cursor.from(event))) {
      console.log(`Projector: event ${event.toString()} already processed`);
      return true;
    }

    const batchAttempt = state.startNextBatch();

    const claimId = event.id.serialize();
    await Promise.all(
      batchAttempt.map((c) =>
        this.store.claim(checkpointId, claimId, c.eventId),
      ),
    );

    const state2 = await this.store.expected(checkpointId);

    const batch = state2.getClaimed(event.id);

    if (batch.length === 0) {
      console.log(
        `Projector: no batch found for event ${event.toString()}, retrying`,
      );
      await wait(Math.random() * 100 + 100);
      return this.process(event);
    }

    const events = await Promise.all(
      batch.map((cursor) => this.reader.get(cursor.ref)),
    );

    console.log(
      `Projector: processing batch of ${events.length} events`,
      events.map((e) => e.toString()),
    );
    const processed = await this.projection
      .process(checkpointId, events)
      .catch((e) => {
        throw new Error(
          `Failed to process batch for checkpoint ${checkpointId}: ${e.message}`,
        );
      });

    if (processed.some((id) => id?.equals(event.id))) {
      console.log(`Batch contained target event ${event}`);
      return true;
    }

    console.log(`Batch did not contain target event ${event}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.process(event);
  }

  async handle(event: IEsEvent) {
    console.log(`Projector: handling event ${event.toString()}`);
    await this.enqueue(event);
    console.log(`Projector: claimed event ${event.toString()}`);
    await this.process(event);
    console.log(`Projector: processed event ${event.toString()}`);
  }
}

class CheckpointSerializer extends AutoSerializer.First(Checkpoint) {}

class CheckpointStore extends FirestoreStore<Checkpoint> {
  constructor(db: FirebaseFirestore.Firestore) {
    super(db.collection("projection"), new CheckpointSerializer());
  }

  async initialize(id: CheckpointId) {
    const existing = await this.load(id);
    if (existing) {
      return;
    }

    const serialized = await this.serializer.serialize(Checkpoint.initial(id));

    await this.collection
      .doc(id.serialize())
      .create(serialized)
      .catch((e) => {
        if (e.code === 6) {
          return;
        }
        throw e;
      });
  }

  async expected(id: CheckpointId, trx?: FirestoreTransaction) {
    const existing = await this.load(id, trx);
    if (!existing) {
      throw new Error(`Projection state not found: ${id}`);
    }
    existing.clean();
    return existing;
  }

  async claim(id: CheckpointId, claimId: string, eventId: EventId) {
    return this.collection.doc(id.serialize()).update({
      [`claims.${eventId.serialize()}`]: FieldValue.arrayUnion(claimId),
    });
  }

  async enqueue(
    id: CheckpointId,
    event: IEsEvent,
    lock: Lock,
    trx?: FirestoreTransaction,
  ) {
    if (trx) {
      trx.transaction.update(this.collection.doc(id.serialize()), {
        [`tasks.${event.id.serialize()}`]: {
          cursor: Cursor.from(event).serialize(),
          lock: lock.serialize(),
        },
      });
      return;
    }

    await this.collection.doc(id.serialize()).update({
      [`tasks.${event.id.serialize()}`]: {
        cursor: Cursor.from(event).serialize(),
        lock: lock.serialize(),
      },
    });
  }

  async string(id: CheckpointId) {
    const existing = await this.expected(id);
    return existing?.toString().replaceAll(StableEventId.globalseed, "seed");
  }

  async processed(
    id: CheckpointId,
    eventId: EventId,
    trx?: FirestoreTransaction,
  ) {
    if (trx) {
      return trx.transaction.update(this.collection.doc(id.serialize()), {
        [`statuses.${eventId.serialize()}`]: "done",
        [`claims.${eventId.serialize()}`]: FieldValue.delete(),
      });
    }

    await this.collection.doc(id.serialize()).update({
      [`statuses.${eventId.serialize()}`]: "done",
      [`claims.${eventId.serialize()}`]: FieldValue.delete(),
    });

    return;
  }

  async processedBatch(
    id: CheckpointId,
    eventId: EventId,
    batchWriter: WriteBatch,
  ) {
    return batchWriter.update(this.collection.doc(id.serialize()), {
      [`statuses.${eventId.serialize()}`]: "done",
    });
  }

  async failed(id: CheckpointId, eventId: EventId, trx?: FirestoreTransaction) {
    if (trx) {
      return trx.transaction.update(this.collection.doc(id.serialize()), {
        [`statuses.${eventId.serialize()}`]: "failed",
      });
    }

    await this.collection.doc(id.serialize()).update({
      [`statuses.${eventId.serialize()}`]: "failed",
    });

    return;
  }

  async countProcessing(id: CheckpointId) {
    const existing = await this.expected(id);
    return existing.countProcessing();
  }

  async isFinished(id: CheckpointId) {
    const existing = await this.expected(id);
    return existing.tasks.size === 0;
  }
}

export const Carl = {
  Projector,
  Checkpoint,
  CheckpointStore,
};
