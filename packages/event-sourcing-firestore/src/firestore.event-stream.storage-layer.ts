import {
  StreamId,
  type ISerializedChange,
  type ISerializedFact,
  EventReference,
  EventStreamStorageLayer,
  EventCommitResult,
} from "@ddd-ts/core";

import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";

export const serverTimestamp = fb.firestore.FieldValue.serverTimestamp;

export class FirestoreEventStreamStorageLayer
  implements EventStreamStorageLayer
{
  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter = new DefaultConverter(),
  ) {}

  isLocalRevisionOutdatedError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 6
    );
  }

  getCollection(streamId: StreamId) {
    return this.firestore
      .collection("event-store")
      .doc(streamId.aggregateType)
      .collection("streams")
      .doc(streamId.aggregateId)
      .collection("events");
  }

  async append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ) {
    const collection = this.getCollection(streamId);
    const result = new EventCommitResult();

    let revision = expectedRevision + 1;
    for (const change of changes) {
      const ref = collection.doc(`${revision}`);

      result.set(change.id, new EventReference(ref.path), revision);

      trx.transaction.create(
        ref,
        this.converter.toFirestore({
          aggregateType: streamId.aggregateType,
          eventId: change.id,
          aggregateId: streamId.aggregateId,
          revision: revision,
          name: change.name,
          payload: change.payload,
          occurredAt: serverTimestamp(),
          version: change.version,
        }),
      );
      revision++;
    }

    return result;
  }

  async *read(
    streamId: StreamId,
    startAt?: number,
  ): AsyncIterable<ISerializedFact> {
    const collection = this.getCollection(streamId);

    const query = collection
      .where("revision", ">=", startAt || 0)
      .orderBy("revision", "asc");

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = this.converter.fromFirestore(e);
      yield {
        id: data.eventId,
        ref: e.ref.path,
        revision: data.revision,
        name: data.name,
        $name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      };
    }
  }
}
