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
import { StableEventId } from "../write";
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
}) {
  static from(event: IEsEvent) {
    const e = event as IFact;

    const timestamp = (e as any).occurredAt.inner as Timestamp;

    const nano = timestamp.nanoseconds + e.revision * 1000;
    const seconds = timestamp.seconds;

    return new Pointer({
      seconds: seconds,
      nanoseconds: nano,
    });
  }

  serialize() {
    return new Timestamp(this.seconds, this.nanoseconds);
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

    // await this.store.initialize(checkpointId);
    // const state = await this.store.expected(checkpointId);

    // const cursor = Cursor.from(e);

    // if (!state.shouldEnqueue(cursor)) {
    //   console.log(`Skipping ${e.id.serialize()} has already been enqueued`);
    //   return false;
    // }

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

    const queue = this.store.collection
      .doc(checkpointId.serialize())
      .collection("queue");

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

    const batch = await this.store.getNextBatch(checkpointId).catch((e) => {
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

  async initialize(id: CheckpointId) {
    // const existing = await this.load(id);
    // if (existing) {
    //   return;
    // }
    // const serialized = await this.serializer.serialize(Checkpoint.initial(id));
    // await this.collection
    //   .doc(id.serialize())
    //   .create(serialized)
    //   .catch((e) => {
    //     if (e.code === 6) {
    //       return;
    //     }
    //     throw e;
    //   });
  }

  async getTail(id: CheckpointId) {
    this.collection
      .doc(id.serialize())
      .collection("queue")
      .where("processed", "==", false)
      .orderBy("order", "asc")
      .limit(1);
    const doc = await this.collection.doc(id.serialize()).get();
    return doc;
    // const doc = await this.collection.doc(id.serialize()).get();
    // const data = doc.data();

    // if (!data) {
    //   return undefined;
    // }

    // return data.tail;
  }

  async getHead(id: CheckpointId) {
    const doc = await this.collection.doc(id.serialize()).get();
    const data = doc.data();

    if (!data) {
      throw new Error(`Checkpoint not found: ${id}`);
    }

    return data.head;
  }

  async expected(id: CheckpointId, trx?: FirestoreTransaction) {
    const existing = await this.load(id, trx);
    this.collection
      .doc(id.serialize())
      .collection("queue")
      .where("unclaimed", "==", true);
    if (!existing) {
      throw new Error(`Projection state not found: ${id}`);
    }
    existing.clean();
    return existing;
  }

  async getNextBatch(id: CheckpointId) {
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

    const batch: EventReference[] = [];

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
      try {
        await this.collection
          .doc(id.serialize())
          .collection("queue")
          .doc(event[2].id)
          .update(
            {
              claimer,
            },
            { lastUpdateTime: event[1] },
          );
        batch.push(new EventReference(event[2].cursor.ref));
      } catch (e) {
        if (e.code === 9) {
          console.log(`Claimed by another process, skipping ${event[2].id}`);
          break;
        }
        console.log(e);
        break;
      }
    }

    return batch;
  }

  // async claim(id: CheckpointId, claimer: Pointer, eventId: EventId) {
  //   return this.collection
  //     .doc(id.serialize())
  //     .collection("queue")
  //     .doc(eventId.serialize())
  //     .update({
  //       claimer: min(claimer.serialize()),
  //       unclaimed: FieldValue.delete(),
  //       claimed: true,
  //     });
  // }

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
            order: Pointer.from(event.event).serialize(),
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

    // await this.collection.doc(id.serialize()).set({
    //   $name: "Checkpoint",
    //   head: max(tail + events.length),
    // });
  }

  async string(id: CheckpointId) {
    const existing = await this.expected(id);
    return existing?.toString().replaceAll(StableEventId.globalseed, "seed");
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

export const Eric = {
  Projector,
  Checkpoint,
  CheckpointStore,
};
