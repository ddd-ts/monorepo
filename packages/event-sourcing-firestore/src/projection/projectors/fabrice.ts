import { FieldValue, Timestamp, WriteBatch } from "firebase-admin/firestore";
import { Dict, Multiple, Optional, Primitive, Shape } from "@ddd-ts/shape";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { AutoSerializer, EventReference, IFact } from "@ddd-ts/core";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";
import { EventId, IEsEvent } from "@ddd-ts/core";
import { IdMap } from "../../idmap";
import { FirestoreProjectedStreamReader } from "../../firestore.projected-stream.reader";
import { AccountCashflowProjection } from "../cashflow";
import { CheckpointId } from "../checkpoint-id";
import { Lock } from "../lock";
import { Cursor, EventStatus } from "./shared";
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

export function max(n: number) {
  const incr = FieldValue.increment(0);

  //@ts-ignore
  //@ts-ignore
  incr.toProto = (serializer: any, fieldPath: any) => ({
    fieldPath: fieldPath.formattedName,
    maximum: { integerValue: n },
  });

  return incr;
}
export function maxDate(n: number) {
  const incr = FieldValue.increment(0);

  //@ts-ignore
  //@ts-ignore
  incr.toProto = (serializer: any, fieldPath: any) => ({
    fieldPath: fieldPath.formattedName,
    maximum: { timestampValue: n },
  });

  return incr;
}

export function min(n: number) {
  const incr = FieldValue.increment(0);

  //@ts-ignore
  //@ts-ignore
  incr.toProto = (serializer: any, fieldPath: any) => ({
    fieldPath: fieldPath.formattedName,
    minimum: { integerValue: n },
  });

  return incr;
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
    const tasks = this.sortedTasks();
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
        // TODO: ADD TEST FOR JUSTIFYING THIS
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

class Pointer extends Shape({
  seconds: Number,
  nanoseconds: Number,
  revision: Number,
}) {
  static from(event: IEsEvent) {
    const e = event as IFact;

    const timestamp = (e as any).occurredAt.inner as Timestamp;

    const nano = timestamp.nanoseconds;
    const seconds = timestamp.seconds;

    return new Pointer({
      seconds: seconds,
      nanoseconds: nano,
      revision: e.revision,
    });
  }

  static fromTimestamp(timestamp: Timestamp, revision: number) {
    return new Pointer({
      seconds: timestamp.seconds,
      nanoseconds: timestamp.nanoseconds,
      revision: revision,
    });
  }

  toNumber() {
    const { seconds, nanoseconds, revision } = this;

    // build a number that is the timestamp with microseconds precision

    const microseconds = Math.floor(nanoseconds / 1000);

    const timestamp = seconds * 1_000_000 + microseconds;

    // create the integer $seconds$microseconds$revision on max 64 bits
    const spaced = timestamp + revision;

    console.log(`Pointer.serialize:  -> ${spaced}`);

    return spaced;
  }
}

class Projector {
  constructor(
    public readonly projection: AccountCashflowProjection,
    public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
    public readonly store: CheckpointStore,
    public readonly transaction: FirestoreTransactionPerformer,
  ) {}

  async enqueue(e: IEsEvent): Promise<boolean> {
    const checkpointId = this.projection.getCheckpointId(e as any);
    // this actually makes it work with large batches lmao ✓ HeavyHandleConcurrency (10935 ms)
    await wait(Math.random() * 1000 + 100);
    const accountId = e.payload.accountId.serialize();
    const until = (e as any).ref;

    const events = await this.reader.slice(
      this.projection.source,
      accountId,
      undefined,
      until,
    );

    const todo = events.map((e) => {
      const cursor = Cursor.from(e);
      const lock = this.projection.getLock(e);
      return { id: e.id, cursor, lock, event: e };
    });

    await this.store.enqueue(checkpointId, todo).catch((e) => {
      throw new Error(
        `Failed to enqueue events for checkpoint ${checkpointId}: ${e.message}`,
      );
    });

    return false;
  }

  async process(event: IEsEvent): Promise<any> {
    console.log(`Projector: processing event ${event.toString()}`);
    const checkpointId = this.projection.getCheckpointId(event as any);

    const doc = await this.store.collection
      .doc(checkpointId.serialize())
      .collection("queue")
      .doc(event.id.serialize())
      .get();

    if (doc.data()?.processed) {
      console.log(`Projector: event ${event.toString()} already processed`);
      return true;
    }

    // const state = await this.store.expected(checkpointId);

    // if (state.hasCompleted(Cursor.from(event))) {
    //   console.log(`Projector: event ${event.toString()} already processed`);
    //   return true;
    // }

    // const batchAttempt = state.startNextBatch();
    // const claimId = event.id.serialize();
    // await Promise.all(
    //   batchAttempt.map((c) =>
    //     this.store.claim(checkpointId, claimId, c.eventId),
    //   ),
    // );

    // const state2 = await this.store.expected(checkpointId);

    // const batch = state2.getClaimed(event.id);

    const batch = await this.store
      .getNextBatch(checkpointId, event)
      .catch((e) => {
        throw new Error(
          `Failed to get next batch for checkpoint ${checkpointId.serialize()}: ${e.message}`,
        );
      });

    if (batch.length === 0) {
      console.log(
        `Projector: no batch found for event ${event.toString()}, retrying`,
      );
      await wait(Math.random() * 100 + 1000);
      return this.process(event);
    }

    const events = await Promise.all(
      batch.map((cursor) => this.reader.get(cursor)),
    );

    console.log(
      `Projector: processing batch of ${events.length} events`,
      events.map((e) => e.toString()),
    );
    const processed = await this.projection
      .process(checkpointId, events)
      .catch((e) => {
        throw new Error(
          `Failed to process batch for checkpoint ${checkpointId.serialize()}: ${e.message}`,
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

class CheckpointStore extends FirestoreStore<Checkpoint, any> {
  constructor(db: FirebaseFirestore.Firestore) {
    super(db.collection("projection"), new CheckpointSerializer());
  }

  async deleteProcessedUntil(id: CheckpointId, tail: any) {
    const batch = this.collection
      .doc(id.serialize())
      .collection("queue")
      .where("processed", "==", true)
      .orderBy("order", "asc")
      .endBefore(tail);

    const all = await batch.get();

    if (all.empty) {
      return;
    }

    for (const doc of all.docs) {
      await doc.ref.delete();
    }
  }

  async getNextBatch(id: CheckpointId, k: IEsEvent) {
    let query = this.collection
      .doc(id.serialize())
      .collection("queue")
      .orderBy("order", "asc");

    const tail = await this.collection
      .doc(id.serialize())
      .collection("queue")
      .where("processed", "==", false)
      .orderBy("order", "asc")
      .limit(1)
      .get();

    if (tail.docs[0]) {
      const tailCursor = Cursor.deserialize(tail.docs[0].data().cursor);
      if (tailCursor.isAfter(Cursor.from(k))) {
        console.warn(
          `Tail cursor ${tailCursor.serialize()} is after event ${k.id.serialize()}`,
        );
        return [];
      }

      query = query.startAt(tail.docs[0]);
    }

    const all = await query.get();

    const events = all.docs.map(
      (doc) => [doc.ref, doc.createTime, doc.data()] as const,
    );

    const firstNonProcessed = events.findIndex((e) => !e[2].processed);
    const eventsToProcess = events.slice(firstNonProcessed);

    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];

    const batch: (readonly [any, any, any])[] = [];

    const claimer = EventId.generate().serialize();

    for (const event of eventsToProcess) {
      const lock = Lock.deserialize(event[2].lock);

      if (event[2].processed) {
        continue;
      }

      if (event[2].claimed) {
        locks.push(lock);
        continue;
      }

      if (locks.some((l) => l.restrains(lock))) {
        locks.push(lock);
        continue;
      }

      if (batchLocks.some((l) => l.restrains(lock, false))) {
        locks.push(lock);
        continue;
      }

      batchLocks.push(lock);

      batch.push(event);
    }

    const batcher = this.firestore.batch();

    for (const [ref, time, event] of batch) {
      const taskRef = this.collection
        .doc(id.serialize())
        .collection("queue")
        .doc(event.id);

      batcher.update(
        taskRef,
        {
          claimer: claimer,
        },
        {
          lastUpdateTime: time,
        },
      );
    }

    // if (tail.docs.length !== 0) {
    //   const data = tail.docs[0].data();

    //   batcher.set(this.collection.doc(id.serialize()), {
    //     tail: max(
    //       Pointer.fromTimestamp(
    //         data.cursor.occurredAt,
    //         data.cursor.revision,
    //       ).toNumber(),
    //     ),
    //   });
    // }

    try {
      await batcher.commit();
    } catch (e) {
      console.error(
        `Failed to commit batch for checkpoint ${id.serialize()}:`,
        e,
      );
      await wait(1000);
      return this.getNextBatch(id, k);
    }

    return batch.map(([ref, time, event]) => {
      return new EventReference(event.cursor.ref);
    });
  }

  async enqueue(
    id: CheckpointId,
    events: { id: EventId; event: IEsEvent; cursor: Cursor; lock: Lock }[],
  ) {
    const queue = this.collection.doc(id.serialize()).collection("queue");

    await Promise.all(
      events.map((event) => {
        const taskRef = queue.doc(event.id.serialize());
        return taskRef
          .create({
            $name: "Task",
            id: event.id.serialize(),
            cursor: event.cursor.serialize(),
            lock: event.lock.serialize(),
            processed: false,
            unclaimed: true,
            // order: Pointer.from(event.event).serialize(),
            order: Pointer.from(event.event).toNumber(),
            queuedAt: FieldValue.serverTimestamp(),
          })
          .catch((e) => {
            if (e.code === 6) {
              // Document already exists, ignore
              return;
            }
            throw e;
          });
      }),
    );
  }

  async processed(
    id: CheckpointId,
    eventIds: EventId[],
    context: {
      transaction?: FirestoreTransaction;
      batchWriter?: WriteBatch;
    } = {},
  ) {
    const { transaction, batchWriter } = context;

    if (transaction) {
      for (const eventId of eventIds) {
        transaction.transaction.update(
          this.collection
            .doc(id.serialize())
            .collection("queue")
            .doc(eventId.serialize()),
          {
            processed: true,
          },
        );
      }
      return;
    }

    await Promise.all(
      eventIds.map((eventId) =>
        this.collection
          .doc(id.serialize())
          .collection("queue")
          .doc(eventId.serialize())
          .update({
            processed: true,
          }),
      ),
    );

    return;
  }
}

export const Fabrice = {
  Projector,
  Checkpoint,
  CheckpointStore,
};
