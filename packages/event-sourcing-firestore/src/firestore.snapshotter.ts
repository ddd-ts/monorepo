import {
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import { FirestoreStore } from "@ddd-ts/store-firestore";

export class FirestoreSnapshotter<
  A extends IEventSourced & IIdentifiable,
> extends FirestoreStore<A> {
  constructor(
    private readonly aggregate: string,
    db: FirebaseFirestore.Firestore,
    serializer: ISerializer<A>,
    converter?: FirebaseFirestore.FirestoreDataConverter<FirebaseFirestore.DocumentData>,
  ) {
    super(
      "irrelevant",
      db,
      {
        deserialize: async (serialized: any) => {
          const { revision, ...content } = serialized;
          const instance = await serializer.deserialize(content);
          instance.acknowledgedRevision = Number(revision);
          return instance;
        },
        serialize: async (instance: A) => {
          return {
            revision: instance.acknowledgedRevision,
            ...(await serializer.serialize(instance)),
          };
        },
      },
      converter,
    );
    this.collection = db
      .collection("event-store")
      .doc(this.aggregate)
      .collection("streams")
      .withConverter(this.converter);
  }
}
