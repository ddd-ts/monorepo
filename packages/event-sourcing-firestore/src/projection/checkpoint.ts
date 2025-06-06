import { AutoSerializer, EventId, IEsEvent } from "@ddd-ts/core";
import { Shape } from "../../../shape/dist";
import { CheckpointId } from "./checkpoint-id";
import { Cursor, EventStatus, ProcessingStartedAt, Thread } from "./thread";
import { Lock } from "./lock";
import { IdMap } from "../idmap";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";
import { StableEventId } from "./write";
import { FieldValue, WriteBatch } from "firebase-admin/firestore";

export class ProjectionCheckpoint extends Shape({
  id: CheckpointId,
  thread: Thread,
}) {
  shouldEnqueue(cursor: Cursor) {
    if (this.thread.head?.isAfterOrEqual(cursor)) {
      return false;
    }
    return true;
  }

  hasCompleted(cursor: Cursor) {
    if (
      Object.values(this.thread.tasks).some((task) => task.cursor.is(cursor))
    ) {
      return this.thread.statuses.get(cursor.eventId)?.is("done");
    }
    return this.thread.head?.isAfterOrEqual(cursor) ?? false;
  }

  enqueue(event: IEsEvent, lock: Lock, timeout?: number) {
    this.thread.enqueue(Cursor.from(event), lock, timeout);
  }

  static initial(id: CheckpointId) {
    return new ProjectionCheckpoint({
      id,
      thread: new Thread({
        head: undefined,
        tasks: [],
        counter: -1,
        statuses: IdMap.for(EventId, EventStatus),
        processingStartedAt: IdMap.for(EventId, ProcessingStartedAt),
      }),
    });
  }

  toString() {
    return this.thread.toString();
  }
}

class ProjectionCheckpointSerializer extends AutoSerializer.First(
  ProjectionCheckpoint,
) {}

export class ProjectionCheckpointStore extends FirestoreStore<ProjectionCheckpoint> {
  constructor(db: FirebaseFirestore.Firestore) {
    super(db.collection("projection"), new ProjectionCheckpointSerializer());
  }

  async initialize(id: CheckpointId) {
    const existing = await this.load(id);
    if (existing) {
      return;
    }

    const serialized = await this.serializer.serialize(
      ProjectionCheckpoint.initial(id),
    );

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
    existing.thread.clean();
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
      [`thread.tasks.${revision}`]: {
        cursor: Cursor.from(event).serialize(),
        lock: lock.serialize(),
        revision,
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
        [`thread.statuses.${eventId.serialize()}`]: "failed",
      });
    }

    await this.collection.doc(id.serialize()).update({
      [`thread.statuses.${eventId.serialize()}`]: "failed",
    });

    return;
  }
}
