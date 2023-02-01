import { Snapshotter, EsAggregate } from "@ddd-ts/event-sourcing";
import { Serializer } from "@ddd-ts/model";

export class FirestoreSnapshotter<
  S extends Serializer<EsAggregate>
> extends Snapshotter<S extends Serializer<infer A> ? A : never> {
  constructor(
    private readonly db: FirebaseFirestore.Firestore,
    public readonly serializer: S
  ) {
    super();
  }

  async load(id: ReturnType<S["getIdFromModel"]>): Promise<any> {
    const query = await this.db
      .collection("snapshots")
      .where("aggregateId", "==", id.toString())
      .orderBy("revision", "desc")
      .limit(1)
      .get();

    const document = query.docs[0];

    if (!document || !document.exists) {
      return undefined;
    }

    const snapshot = document.data();

    if (!snapshot) {
      return undefined;
    }

    return this.serializer.deserialize(snapshot.serialized);
  }

  async save(
    aggregate: S extends Serializer<infer A> ? A : never
  ): Promise<void> {
    const id = this.serializer.getIdFromModel(aggregate);
    await this.db
      .collection("snapshots")
      .doc(id.toString() + "." + aggregate.acknowledgedRevision.toString())
      .set({
        id: id.toString(),
        revision: Number(aggregate.acknowledgedRevision),
        serialized: await this.serializer.serialize(aggregate),
      });
  }
}
