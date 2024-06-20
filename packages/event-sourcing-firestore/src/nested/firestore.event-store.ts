import {
  AggregateStreamId,
  ConcurrencyError,
  IChange,
  IFact,
} from "@ddd-ts/core";
import type { FirestoreTransaction } from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";

export class NestedFirestoreEventStore {
  constructor(public readonly firestore: fb.firestore.Firestore) {}

  get collection() {
    return this.firestore.collection("event-store");
  }

  async close() {}

  async append(
    streamId: AggregateStreamId,
    changes: IChange[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ): Promise<void> {
    const collection = this.collection
      .doc(streamId.aggregate)
      .collection("streams")
      .doc(streamId.id)
      .collection("events");

    const next = await trx.transaction.get(
      collection.doc(`${expectedRevision + 1}`),
    );
    if (next.exists) {
      throw new ConcurrencyError(
        `Concurrency error on ${streamId.aggregate} ${streamId.id}`,
      );
    }

    if (expectedRevision > -1) {
      const lastEvent = await trx.transaction.get(
        collection.doc(`${expectedRevision}`),
      );
      if (!lastEvent.exists) {
        throw new Error(
          `Expected revision ${expectedRevision} not found for ${streamId.aggregate} ${streamId.id}`,
        );
      }
    }

    let revision = expectedRevision + 1;

    for (const change of changes) {
      trx.transaction.create(collection.doc(`${revision}`), {
        aggregateType: streamId.aggregate,
        eventId: change.id.toString(),
        aggregateId: streamId.id.toString(),
        revision: revision,
        name: change.name,
        payload: change.payload,
        occurredAt: fb.firestore.FieldValue.serverTimestamp(),
      });
      revision++;
    }
  }

  async *read(
    streamId: AggregateStreamId,
    from?: number,
  ): AsyncIterable<IFact> {
    const collection = this.collection
      .doc(streamId.aggregate)
      .collection("streams")
      .doc(streamId.id)
      .collection("events");

    const query = collection
      .where("revision", ">=", from || 0)
      .orderBy("revision", "asc");

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = e.data();
      yield {
        id: data.eventId,
        revision: data.revision,
        name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt.toDate(),
      };
    }
  }
}
