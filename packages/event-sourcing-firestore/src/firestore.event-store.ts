import {
  AggregateStreamId,
  type ISerializedChange,
  type ISerializedFact,
} from "@ddd-ts/core";

import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";
export const serverTimestamp = fb.firestore.FieldValue.serverTimestamp;
export class FirestoreEventStore {
  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter: fb.firestore.FirestoreDataConverter<fb.firestore.DocumentData> = new DefaultConverter(),
  ) {}

  get collection() {
    return this.firestore.collection("event-store");
  }

  getStream(streamId: AggregateStreamId) {
    return this.collection
      .doc(streamId.aggregate)
      .collection("streams")
      .doc(streamId.id)
      .collection("events");
  }

  async close() {}

  async bulkAppend(
    toAppend: {
      streamId: AggregateStreamId;
      changes: ISerializedChange[];
      expectedRevision: number;
    }[],
    trx: FirestoreTransaction,
  ) {
    await Promise.all(
      toAppend.map(async ({ streamId, changes, expectedRevision }) => {
        await this.commitChanges(streamId, changes, expectedRevision, trx);
      }),
    );
  }

  private async commitChanges(
    streamId: AggregateStreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ) {
    const collection = this.getStream(streamId);

    let revision = expectedRevision + 1;
    for (const change of changes) {
      trx.transaction.create(
        collection.doc(`${revision}`),
        this.converter.toFirestore({
          aggregateType: streamId.aggregate,
          eventId: change.id,
          aggregateId: streamId.id,
          revision: revision,
          name: change.name,
          payload: change.payload,
          occurredAt: serverTimestamp(),
          version: change.version,
        }),
      );
      revision++;
    }
  }

  async append(
    streamId: AggregateStreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ): Promise<void> {
    await this.commitChanges(streamId, changes, expectedRevision, trx);
  }

  async *read(
    streamId: AggregateStreamId,
    from?: number,
  ): AsyncIterable<ISerializedFact> {
    const collection = this.getStream(streamId);

    const query = collection
      .where("revision", ">=", from || 0)
      .orderBy("revision", "asc");

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = this.converter.fromFirestore(e);
      yield {
        id: data.eventId,
        revision: data.revision,
        name: data.name,
        $kind: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      };
    }
  }
}
