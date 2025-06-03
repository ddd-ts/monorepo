import { WriteBatch } from "firebase-admin/firestore";
import { Multiple, Optional, Shape } from "@ddd-ts/shape";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { Cursor, EventStatus, ProcessingStartedAt } from "./shared";
import { IdMap } from "../../idmap";
import { AccountCashflowProjection } from "../cashflow";
import { FirestoreProjectedStreamReader } from "../../firestore.projected-stream.reader";
import { HeadMemoryProjectionCheckpointStore } from "./head-memory/head-memory.checkpoint-store";
import { AutoSerializer } from "@ddd-ts/core";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";
import { EventId, IEsEvent } from "@ddd-ts/core";
import { CheckpointId } from "../checkpoint-id";
import { Lock } from "../lock";
import { StableEventId } from "../write";

class Checkpoint extends Shape({
  id: CheckpointId,
  head: Optional(Cursor),
  tasks: Multiple({
    cursor: Cursor,
    lock: Lock,
    timeout: Optional(Number),
    enqueuedAt: Date,
  }),
  statuses: IdMap(EventId, EventStatus),
  processingStartedAt: IdMap(EventId, ProcessingStartedAt),
}) {
  static initial(id: CheckpointId) {
    return new Checkpoint({
      id,
      head: undefined,
      tasks: [],
      statuses: IdMap.for(EventId, EventStatus),
      processingStartedAt: IdMap.for(EventId, ProcessingStartedAt),
    });
  }

  shouldEnqueue(cursor: Cursor) {
    if (this.head?.isAfterOrEqual(cursor)) {
      return false;
    }
    return true;
  }

  hasCompleted(cursor: Cursor) {
    if (this.tasks.some((task) => task.cursor.is(cursor))) {
      return this.statuses.get(cursor.eventId)?.is("done");
    }
    return this.head?.isAfterOrEqual(cursor) ?? false;
  }

  enqueue(cursor: Cursor, lock: Lock, timeout?: number) {
    if (this.head?.isAfterOrEqual(cursor)) {
      return;
    }
    this.tasks.push({ cursor, lock, timeout, enqueuedAt: new Date() });
    this.head = cursor;
  }

  clean() {
    for (const task of [...this.tasks]) {
      const status = this.statuses.get(task.cursor.eventId);

      if (!status?.is("done")) {
        return;
      }

      this.tasks.shift();
      this.statuses.delete(task.cursor.eventId);
      this.processingStartedAt.delete(task.cursor.eventId);
    }
  }

  startNextBatch() {
    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];
    const batch: Cursor[] = [];

    for (const task of [...this.tasks]) {
      if (locks.some((lock) => lock.restrains(task.lock))) {
        // TODO: ADD TEST FOR JUSTIFYING THIS
        locks.push(task.lock);
        continue;
      }

      if (batchLocks.some((lock) => lock.restrains(task.lock, false))) {
        locks.push(task.lock);
        continue;
      }

      const status = this.statuses.get(task.cursor.eventId);
      if (status?.is("processing") || status?.is("done")) {
        locks.push(task.lock);
        continue;
      }

      batch.push(task.cursor);
      batchLocks.push(task.lock);

      this.statuses.set(task.cursor.eventId, EventStatus.processing());
      this.processingStartedAt.set(
        task.cursor.eventId,
        new ProcessingStartedAt(new Date()),
      );
    }

    return batch;
  }
}

class Projector {
  constructor(
    public readonly projection: AccountCashflowProjection,
    public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
    public readonly store: HeadMemoryProjectionCheckpointStore,
    public readonly transaction: FirestoreTransactionPerformer,
  ) {}

  async enqueue(e: IEsEvent): Promise<boolean> {
    const checkpointId = this.projection.getShardCheckpointId(e as any);

    const accountId = e.payload.accountId.serialize();
    const until = (e as any).ref;

    await this.store.initialize(checkpointId);
    const state = await this.store.expected(checkpointId);

    const cursor = Cursor.from(e);

    if (!state.shouldEnqueue(cursor)) {
      console.log(
        `Skipping event ${e.id.serialize()} as it is after the last cursor ${state.head?.ref.serialize()}`,
      );
      return false;
    }

    const stream = this.reader.read(
      this.projection.source,
      accountId,
      state.head?.ref, // MAYBE HEAD ?
      until,
    );

    for await (const event of stream) {
      const handler = this.projection.handlers[event.name];

      const lock = handler.locks(event as any);

      // TRY WITH A SINGLE TRANSACTION OR BATCH
      await this.transaction.perform(async (trx) => {
        const state = await this.store.expected(checkpointId, trx);

        state.enqueue(Cursor.from(event), lock);
        await this.store.save(state, trx);
      });
    }

    return false;
  }

  async process(event: IEsEvent): Promise<any> {
    console.log(`Projector: processing event ${event.toString()}`);
    const checkpointId = this.projection.getShardCheckpointId(event as any);

    const batch = await this.transaction.perform(async (trx) => {
      const state = await this.store.expected(checkpointId, trx);
      if (state.hasCompleted(Cursor.from(event))) {
        return false;
      }
      const batch = state.startNextBatch();
      await this.store.save(state, trx);
      return batch;
    });

    if (!batch) {
      console.log(
        `Skipping event ${event.id.serialize()} as it is after the last cursor`,
      );
      return;
    }

    const events = await Promise.all(
      batch.map((cursor) => this.reader.get(cursor.ref)),
    );

    console.log(
      `Projector: processing batch of ${events.length} events`,
      events.map((e) => e.toString()),
    );
    const processed = await this.projection.process(checkpointId, events);

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

  async enqueue(
    id: CheckpointId,
    event: IEsEvent,
    revision: number,
    lock: Lock,
    trx: FirestoreTransaction,
  ) {
    return trx.transaction.update(this.collection.doc(id.serialize()), {
      [`tasks.${revision}`]: {
        cursor: Cursor.from(event).serialize(),
        lock: lock.serialize(),
        revision,
      },
    });
  }

  async string(id: CheckpointId) {
    const existing = await this.expected(id);
    return existing?.toString().replaceAll(StableEventId.seed, "seed");
  }

  async processed(
    id: CheckpointId,
    eventId: EventId,
    trx?: FirestoreTransaction,
  ) {
    if (trx) {
      return trx.transaction.update(this.collection.doc(id.serialize()), {
        [`statuses.${eventId.serialize()}`]: "done",
      });
    }

    await this.collection.doc(id.serialize()).update({
      [`statuses.${eventId.serialize()}`]: "done",
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
    return existing.tasks.filter((task) =>
      existing.statuses.get(task.cursor.eventId)?.is("processing"),
    ).length;
  }

  async isFinished(id: CheckpointId) {
    const existing = await this.expected(id);
    return existing.tasks.length === 0;
  }
}

export const Albert = {
  Projector,
  Checkpoint,
  CheckpointStore,
};
