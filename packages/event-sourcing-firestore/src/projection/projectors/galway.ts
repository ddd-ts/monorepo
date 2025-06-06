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
  incr.toProto = (serializer: any, fieldPath: any) => ({
    fieldPath: fieldPath.formattedName,
    maximum: { integerValue: n },
  });

  return incr;
}

export function min(n: number) {
  const incr = FieldValue.increment(0);

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
}) {}

class Projector {
  constructor(
    public readonly projection: AccountCashflowProjection,
    public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
    public readonly store: CheckpointStore,
    public readonly transaction: FirestoreTransactionPerformer,
  ) {}

  async handle(event: IEsEvent) {
    console.log(`Handling event ${event}`);

    const source = this.projection.source;
    const id = this.projection.getCheckpointId(event as any);
    const until = (event as any).ref;
    const shard = event.payload.accountId.serialize();

    const checkpoint = await this.store.getCheckpoint(id);

    const headDoc = checkpoint
      ? await this.store.getMapping(id, checkpoint.head)
      : undefined;

    const headref = headDoc?.headref;
    const headCursor = headDoc?.cursor
      ? Cursor.deserialize(headDoc.cursor)
      : undefined;

    if (!headCursor?.isAfterOrEqual(Cursor.from(event))) {
      if (!checkpoint) {
        await this.store
          .checkpoint(id)
          .create({
            head: -1,
          })
          .catch((err) => {
            if (err.code === 6) return; // Already exists
            throw err;
          });
      }

      const events = await this.reader.slice(
        source,
        shard,
        headref ? new EventReference(headref) : undefined,
        until,
      );

      const all = events.map((e, i) => {
        const head = checkpoint ? checkpoint.head + i + 1 : i;
        const batch = this.store.firestore.batch();
        const lock = this.projection.getLock(e);
        batch.create(this.store.queued(id, e.id), {
          order: head,
          headref: (e as any).ref.serialize(),
          cursor: Cursor.from(e).serialize(),
          lock: lock.serialize(),
          ref: (e as any).ref.serialize(),
          processed: false,
        });
        batch.create(this.store.mapping(id, head), {
          headref: (e as any).ref.serialize(),
          cursor: Cursor.from(e).serialize(),
          lock: lock.serialize(),
          ref: (e as any).ref.serialize(),
        });
        batch.update(this.store.checkpoint(id), {
          head: max(head),
        });

        return batch
          .commit()
          .then(() => e.id)
          .catch((err) => {
            if (err.code === 6) return;
            throw err;
          });
      });

      await Promise.allSettled(all);
    }

    const queuedResult = await this.store.queued(id, event.id).get();
    const queued = queuedResult.data();

    if (queued?.processed) {
      console.log(`Event ${event.id.serialize()} is already processed.`);
      return true;
    }

    const tail = this.store
      .queue(id)
      .where("processed", "==", false)
      .orderBy("order", "asc")
      .limit(1);

    const tailDoc = await tail.get();

    let todo = this.store
      .queue(id)
      .where("processed", "==", false)
      .orderBy("order", "asc");

    const dc = tailDoc.docs[0];
    if (dc) {
      todo = todo.startAt(dc);
    }

    const allTodo = await todo.get();

    if (allTodo.empty) {
      console.log(
        `No unprocessed events found for checkpoint ${id.serialize()}`,
      );

      // await wait(1000);
      return this.handle(event);
    }

    const batch = this.store.firestore.batch();

    const claimer = EventId.generate().serialize();

    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];

    for (const doc of allTodo.docs) {
      const data = doc.data();
      const lock = Lock.deserialize(data.lock);

      if (data.processed) {
        continue;
      }

      if (data.claimed) {
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

      batch.update(
        doc.ref,
        {
          claimer: claimer,
        },
        { lastUpdateTime: doc.createTime },
      );
    }

    try {
      await batch.commit();
    } catch (e) {
      // await wait(1000);
      return this.handle(event);
    }

    const claimed = this.store
      .queue(id)
      .where("claimer", "==", claimer)
      .orderBy("order", "asc");

    const claimedDocs = await claimed.get();

    const refs = claimedDocs.docs.map(
      (doc) => new EventReference(doc.data().ref),
    );

    const claimedEvents = await Promise.all(
      refs.map((ref) => this.reader.get(ref)),
    );

    console.log(
      `Processing batch for checkpoint ${id.serialize()} with ${claimedEvents.length} events`,
    );
    const processed = await this.projection
      .process(id, claimedEvents)
      .catch((e) => {
        throw new Error(
          `Failed to process batch for checkpoint ${id.serialize()}: ${e.message}`,
        );
      });

    if (processed.some((id) => id?.equals(event.id))) {
      console.log(`Batch contained target event ${event}`);
      return true;
    }

    console.log(`Batch did not contain target event ${event}`);
    // await wait(1000);
    return this.handle(event);
  }
}

class CheckpointSerializer extends AutoSerializer.First(Checkpoint) {}

class CheckpointStore extends FirestoreStore<Checkpoint, any> {
  constructor(db: FirebaseFirestore.Firestore) {
    super(db.collection("projection"), new CheckpointSerializer());
  }

  checkpoint(id: CheckpointId) {
    return this.collection.doc(id.serialize());
  }

  async getCheckpoint(id: CheckpointId) {
    const doc = await this.checkpoint(id).get();
    return doc.data();
  }

  mapping(id: CheckpointId, head: number) {
    return this.checkpoint(id)
      .collection("mapping")
      .doc(`${head}`.padStart(12, "0"));
  }

  async getMapping(id: CheckpointId, head: number) {
    const mappingDoc = await this.mapping(id, head).get();
    return mappingDoc.data();
  }

  queue(id: CheckpointId) {
    return this.collection.doc(id.serialize()).collection("queue");
  }

  queued(id: CheckpointId, eventId: EventId) {
    return this.collection
      .doc(id.serialize())
      .collection("queue")
      .doc(eventId.serialize());
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

export const Galway = {
  Projector,
  Checkpoint,
  CheckpointStore,
};
