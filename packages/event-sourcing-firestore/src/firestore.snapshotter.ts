import {
  type IEventSourced,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import {
  FirestoreStore,
  type FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import { serverTimestamp } from "./firestore.event-store";

export class FirestoreSnapshotter<
  A extends IEventSourced & IIdentifiable,
> extends FirestoreStore<A> {
  constructor(
    private readonly aggregate: string,
    db: FirebaseFirestore.Firestore,
    serializer: ISerializer<A>,
    converter?: FirebaseFirestore.FirestoreDataConverter<FirebaseFirestore.DocumentData>,
    private debugSnapshots = false,
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

  async save(snapshot: A, trx: FirestoreTransaction): Promise<void> {
    await super.save(snapshot, trx);

    if (this.debugSnapshots) {
      const ref = this.firestore
        .collection("test-snapshots")
        .doc(this.aggregate)
        .collection("snapshots")
        .doc(snapshot.id.toString())
        .collection("versions")
        .doc(
          `${snapshot.acknowledgedRevision}`
            .padStart(6, "0")
            .concat("-", Math.random().toString().substring(2, 8)),
        );

      trx.transaction.set(ref, {
        ...(await this.serializer.serialize(snapshot)),
        occurredAt: serverTimestamp(),
      });
    }
  }
}
