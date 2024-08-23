import {
  AggregateStreamId,
  ConcurrencyError,
  IChange,
  IFact,
} from "@ddd-ts/core";
import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";

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
      changes: IChange[];
      expectedRevision: number;
    }[],
    trx: FirestoreTransaction,
  ) {
    await Promise.all(
      toAppend.map(
        async ({ streamId, expectedRevision }) =>
          await this.lockDocument(streamId, expectedRevision, trx),
      ),
    );

    await Promise.all(
      toAppend.map(async ({ streamId, changes, expectedRevision }) => {
        await this.commitChanges(streamId, changes, expectedRevision, trx);
      }),
    );
  }

  private async lockDocument(
    streamId: AggregateStreamId,
    expectedRevision: number,
    trx: FirestoreTransaction,
  ) {
    // const collection = this.getStream(streamId);
    // const [targetOp, prevOp] = [
    //   trx.transaction.get(collection.doc(`${expectedRevision + 1}`)),
    //   trx.transaction.get(collection.doc(`${expectedRevision}`)),
    // ]
    // const target = await targetOp;
    // if (target.exists) {
    //   throw new ConcurrencyError(
    //     `Concurrency error on ${streamId.aggregate} ${streamId.id}`,
    //   );
    // }
    // if (expectedRevision > -1) {
    //   const previous = await prevOp;
    //   if (!previous.exists) {
    //     throw new Error(
    //       `Expected revision ${expectedRevision} not found for ${streamId.aggregate} ${streamId.id}`,
    //     );
    //   }
    // }
  }

  private async commitChanges(
    streamId: AggregateStreamId,
    changes: IChange[],
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
          eventId: change.id.toString(),
          aggregateId: streamId.id.toString(),
          revision: revision,
          name: change.name,
          payload: change.payload,
          occurredAt: fb.firestore.FieldValue.serverTimestamp(),
        }),
      );
      revision++;
    }
  }

  async append(
    streamId: AggregateStreamId,
    changes: IChange[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ): Promise<void> {
    await this.lockDocument(streamId, expectedRevision, trx);
    await this.commitChanges(streamId, changes, expectedRevision, trx);
  }

  async *read(
    streamId: AggregateStreamId,
    from?: number,
  ): AsyncIterable<IFact> {
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
        payload: data.payload,
        occurredAt: data.occurredAt,
      };
    }
  }
}
