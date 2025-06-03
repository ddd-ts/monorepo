import { WriteBatch } from "firebase-admin/firestore";
import { AutoSerializer } from "@ddd-ts/core";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";
import { EventId, IEsEvent } from "@ddd-ts/core";

import { CheckpointId } from "../../checkpoint-id";
import { Lock } from "../../lock";
import { StableEventId } from "../../write";
import { Cursor } from "../shared";
import { ProjectionCheckpoint } from "./tail-material.checkpoint";

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
