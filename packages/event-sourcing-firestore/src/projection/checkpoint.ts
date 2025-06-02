import { AutoSerializer, EventId, IEsEvent } from "@ddd-ts/core";
import { Shape } from "../../../shape/dist";
import { ProjectionCheckpointId } from "./checkpoint-id";
import { Cursor, EventStatus, Thread } from "./thread";
import { Lock } from "./lock";
import { IdMap } from "../idmap";
import { FirestoreStore, FirestoreTransaction } from "@ddd-ts/store-firestore";

export class ProjectionCheckpoint extends Shape({
  id: ProjectionCheckpointId,
  thread: Thread,
}) {
  isTailAfterOrEqual(cursor: Cursor) {
    return this.thread.tail?.isAfterOrEqual(cursor) ?? false;
  }

  enqueue(event: IEsEvent, lock: Lock, previous?: EventId) {
    this.thread.enqueue(Cursor.from(event), lock, previous);
  }

  process(eventId: EventId) {
    this.thread.process(eventId);
  }

  processed(eventId: EventId) {
    this.thread.processed(eventId);
  }

  static initial(id: ProjectionCheckpointId) {
    return new ProjectionCheckpoint({
      id,
      thread: new Thread({
        tail: undefined,
        head: undefined,
        tasks: [],
        statuses: IdMap.for(EventId, EventStatus),
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

  async initialize(id: ProjectionCheckpointId) {
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

  async expected(id: ProjectionCheckpointId, trx?: FirestoreTransaction) {
    const existing = await this.load(id, trx);
    if (!existing) {
      throw new Error(`Projection state not found: ${id}`);
    }
    return existing;
  }

  async processed(
    id: ProjectionCheckpointId,
    eventId: EventId,
    trx?: FirestoreTransaction,
  ) {
    if (trx) {
      return trx.transaction.update(this.collection.doc(id.serialize()), {
        [`thread.statuses.${eventId.serialize()}`]: "done",
      });
    }

    await this.collection.doc(id.serialize()).update({
      [`thread.statuses.${eventId.serialize()}`]: "done",
    });

    return;
  }
}
