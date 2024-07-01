import {
  type IEventSourced,
  type ISerializer,
  type IIdentifiable,
} from "@ddd-ts/core";
import {
  DefaultConverter,
  type FirestoreTransaction,
} from "@ddd-ts/store-firestore";

export class FlatFirestoreSnapshotter<A extends IEventSourced & IIdentifiable> {
  constructor(
    private readonly db: FirebaseFirestore.Firestore,
    public readonly serializer: ISerializer<A>,
    public readonly converter: FirebaseFirestore.FirestoreDataConverter<FirebaseFirestore.DocumentData> = new DefaultConverter(),
  ) {}

  async load(id: A["id"]): Promise<A | undefined> {
    const query = await this.db
      .collection("snapshots")
      .where("id", "==", id.toString())
      .orderBy("revision", "desc")
      .limit(1)
      .get();

    const document = query.docs[0];

    if (!document || !document.exists) {
      return undefined;
    }

    const snapshot = this.converter.fromFirestore(document);

    if (!snapshot) {
      return undefined;
    }

    const instance = await this.serializer.deserialize(snapshot.serialized);
    instance.acknowledgedRevision = Number(snapshot.revision);
    return instance;
  }

  async save(aggregate: A, trx: FirestoreTransaction): Promise<void> {
    const id = aggregate.id.toString();
    await trx.transaction.set(
      this.db
        .collection("snapshots")
        .doc(`${id.toString()}.${aggregate.acknowledgedRevision.toString()}`),
      this.converter.toFirestore({
        id: id.toString(),
        revision: Number(aggregate.acknowledgedRevision),
        serialized: await this.serializer.serialize(aggregate),
      }),
    );
  }
}
