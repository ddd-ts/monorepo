import {
  type AggregateStreamId,
  ConcurrencyError,
  type IChange,
  type IFact,
} from "@ddd-ts/core";
import {
  DefaultConverter,
  type FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";

export class FlatFirestoreEventStore {
  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter: fb.firestore.FirestoreDataConverter<fb.firestore.DocumentData> = new DefaultConverter(),
  ) {}

  get aggregateCollection() {
    return this.firestore.collection("events");
  }

  async close() {}

  async append(
    streamId: AggregateStreamId,
    changes: IChange[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ): Promise<void> {
    const eventsOccuredAfter = await trx.transaction.get(
      this.aggregateCollection
        .where("aggregateType", "==", streamId.aggregate)
        .where("aggregateId", "==", streamId.id)
        .where("revision", ">", expectedRevision),
    );
    const hasEventAfter = eventsOccuredAfter.docs.length > 0;

    if (hasEventAfter) {
      throw new ConcurrencyError(
        `Concurrency error on ${streamId.aggregate} ${streamId.id}`,
      );
    }

    let revision = expectedRevision + 1;

    for (const change of changes) {
      trx.transaction.create(
        this.aggregateCollection.doc(change.id.toString()),
        this.converter.toFirestore({
          aggregateType: streamId.aggregate,
          id: change.id.toString(),
          aggregateId: streamId.id.toString(),
          revision: revision,
          type: change.name,
          payload: change.payload,
          occurredAt: fb.firestore.FieldValue.serverTimestamp(),
        }),
      );
      await new Promise((r) => setTimeout(r, 1)); // ensure occurredAt is unique
      revision++;
    }
  }

  async *read(
    streamId: AggregateStreamId,
    from?: number,
  ): AsyncIterable<IFact> {
    let query = this.aggregateCollection
      .where("aggregateType", "==", streamId.aggregate)
      .where("aggregateId", "==", streamId.id)
      .orderBy("revision", "asc");

    if (from) {
      query = query.where("revision", ">", from);
    }

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = this.converter.fromFirestore(e);
      yield {
        id: e.id,
        revision: data.revision,
        name: data.type,
        payload: data.payload,
        occurredAt: data.occurredAt,
      };
    }
  }
}
