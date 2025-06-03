import { WriteBatch } from "firebase-admin/firestore";
import { AutoSerializer } from "@ddd-ts/core";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";
import { Multiple, Optional, Shape } from "@ddd-ts/shape";
import { EventId, IEsEvent } from "@ddd-ts/core";

import { CheckpointId } from "../../checkpoint-id";
import { IdMap } from "../../../idmap";
import { Lock } from "../../lock";
import { StableEventId } from "../../write";
import { Cursor, EventStatus, ProcessingStartedAt } from "../shared";

export class ProjectionCheckpoint extends Shape({
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
    return new ProjectionCheckpoint({
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

  toString() {
    return [
      "",
      `HEAD: ${this.head}`,
      ...this.tasks.map(
        (task) =>
          `\t${task.cursor.ref.serialize()} ${this.statuses.get(task.cursor.eventId)?.serialize()}`,
      ),
      "",
    ]
      .join("\n")
      .replaceAll(StableEventId.seed, "seed");
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
}
