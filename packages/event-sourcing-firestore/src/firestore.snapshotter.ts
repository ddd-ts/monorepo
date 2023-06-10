import {
  Snapshotter,
  EsAggregate,
  EsAggregateId,
} from "@ddd-ts/event-sourcing";
import { Serializer } from "@ddd-ts/model";

export class FirestoreSnapshotter<
  A extends EsAggregate<EsAggregateId, any>
> extends Snapshotter<A> {
  constructor(
    private readonly db: FirebaseFirestore.Firestore,
    public readonly serializer: Serializer<A>
  ) {
    super();
  }

  async load(id: A["id"]): Promise<any> {
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

  async save(aggregate: A): Promise<void> {
    const id = aggregate.id.toString();
    await this.db
      .collection("snapshots")
      .doc(id + "." + aggregate.acknowledgedRevision.toString())
      .set({
        id,
        revision: Number(aggregate.acknowledgedRevision),
        serialized: await this.serializer.serialize(aggregate),
      });
  }
}
