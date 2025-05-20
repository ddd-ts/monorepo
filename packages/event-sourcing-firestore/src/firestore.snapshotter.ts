import {
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import { FirestoreStore } from "@ddd-ts/store-firestore";

class SnapshotSerializer<A extends IEventSourced & IIdentifiable> {
  constructor(
    private readonly serializer: ISerializer<A>,
    private readonly aggregateType: string,
  ) {}

  async serialize(instance: A) {
    const serialized = await this.serializer.serialize(instance);
    return {
      ...serialized,
      $name: this.aggregateType,
      revision: instance.acknowledgedRevision,
    };
  }

  async deserialize(serialized: any) {
    const { revision, ...content } = serialized;
    const instance = await this.serializer.deserialize({
      $name: this.aggregateType,
      ...content,
    });
    instance.acknowledgedRevision = Number(revision);
    return instance;
  }
}

export class FirestoreSnapshotter<
  A extends IEventSourced & IIdentifiable,
> extends FirestoreStore<A> {
  constructor(
    aggregateType: string,
    database: FirebaseFirestore.Firestore,
    serializer: ISerializer<A>,
  ) {
    const collection = database
      .collection("event-store")
      .doc(aggregateType)
      .collection("streams");
    super(
      collection,
      new SnapshotSerializer(serializer, aggregateType),
      aggregateType,
    );
  }
}
