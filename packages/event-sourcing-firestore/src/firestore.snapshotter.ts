import { Snapshotter, EsAggregate } from "@ddd-ts/event-sourcing";
import { Model } from "@ddd-ts/model";
import { ISerializer } from "@ddd-ts/serialization";

export class FirestoreSnapshotter<
  S extends ISerializer<EsAggregate<any, any>>,
> extends Snapshotter<S extends ISerializer<infer A> ? A : never> {
  constructor(
    private readonly db: FirebaseFirestore.Firestore,
    public readonly serializer: S,
  ) {
    super();
  }

  private getIdFromModel(m: S extends ISerializer<infer A> ? A : never) {
    if (Object.getOwnPropertyNames(m.id).includes("serialize")) {
      if ("serialize" in m.id) {
        return m.id.serialize();
      }
    }
    return m.id.toString();
  }

  async load(
    id: S extends ISerializer<infer M extends Model> ? M["id"] : never,
  ): Promise<any> {
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
    aggregate: S extends ISerializer<infer A> ? A : never,
  ): Promise<void> {
    const id = this.getIdFromModel(aggregate);
    await this.db
      .collection("snapshots")
      .doc(`${id.toString()}.${aggregate.acknowledgedRevision.toString()}`)
      .set({
        id: id.toString(),
        revision: Number(aggregate.acknowledgedRevision),
        serialized: await this.serializer.serialize(aggregate),
      });
  }
}
