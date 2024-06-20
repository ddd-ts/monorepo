import {
  type AggregateStreamId,
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import type { FirestoreTransaction } from "@ddd-ts/store-firestore";

export class NestedFirestoreSnapshotter<
  A extends IEventSourced & IIdentifiable,
> {
  constructor(
    private readonly db: FirebaseFirestore.Firestore,
    public readonly serializer: ISerializer<A>,
  ) {}

  async load(streamId: AggregateStreamId): Promise<A | undefined> {
    const document = await this.db
      .collection("event-store")
      .doc(streamId.aggregate)
      .collection("streams")
      .doc(streamId.id)
      .get();

    if (!document || !document.exists) {
      return undefined;
    }

    const snapshot = document.data();

    if (!snapshot) {
      return undefined;
    }

    const instance = await this.serializer.deserialize(snapshot.content as any);
    instance.acknowledgedRevision = Number(snapshot.revision);
    return instance;
  }

  async save(aggregate: A, trx: FirestoreTransaction): Promise<void> {
    const streamId = aggregate.getAggregateStreamId();

    trx.transaction.set(
      this.db
        .collection("event-store")
        .doc(streamId.aggregate)
        .collection("streams")
        .doc(streamId.id),
      {
        revision: aggregate.acknowledgedRevision,
        content: await this.serializer.serialize(aggregate),
      },
    );
  }
}
