import { Serializer, Store } from "@ddd-ts/model";
import {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  DocumentData,
  Transaction,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

export class FirestoreStore<Model extends { id: { toString(): string } }>
  implements Store<Model>
{
  collection: CollectionReference;

  constructor(
    public readonly collectionName: string,
    public readonly firestore: Firestore,
    public readonly serializer: Serializer<
      Model,
      { id: string; version: bigint }
    >,
    public readonly converter?: FirestoreDataConverter<DocumentData>
  ) {
    if (this.converter) {
      this.collection = this.firestore
        .collection(collectionName)
        .withConverter(this.converter);
    } else {
      this.collection = this.firestore.collection(collectionName);
    }
  }

  protected async executeQuery(
    query: FirebaseFirestore.Query<any>,
    trx?: FirebaseFirestore.Transaction
  ): Promise<Model[]> {
    const result = trx ? await trx.get(query) : await query.get();

    return Promise.all(
      result.docs.map((doc) =>
        this.serializer.deserialize({ id: doc.id, ...doc.data() })
      )
    );
  }

  protected async *streamQuery(
    query: FirebaseFirestore.Query<any>
  ): AsyncIterable<Model> {
    const stream: AsyncIterable<QueryDocumentSnapshot> = query.stream() as any;
    for await (const doc of stream) {
      yield this.serializer.deserialize({ id: doc.id, ...doc.data() });
    }
  }

  async save(model: Model, trx?: Transaction): Promise<void> {
    const serialized = await this.serializer.serialize(model);
    const ref = this.collection.doc(model.id.toString());

    trx ? trx.set(ref, serialized) : await ref.set(serialized);
  }

  async load(id: Model["id"], trx?: Transaction): Promise<Model | undefined> {
    const ref = this.collection.doc(id.toString());

    const snapshot = trx ? await trx.get(ref) : await ref.get();

    if (!snapshot.exists) {
      return undefined;
    }

    return this.serializer.deserialize({
      id: id.toString(),
      ...(snapshot.data() as any),
    });
  }

  async loadAll(): Promise<Model[]> {
    const snapshot = await this.collection.get();
    return Promise.all(
      snapshot.docs.map((doc) =>
        this.serializer.deserialize({ id: doc.id, ...(doc.data() as any) })
      )
    );
  }

  async delete(id: Model["id"], trx?: Transaction): Promise<void> {
    if (trx) {
      trx.delete(this.collection.doc(id.toString()));
    } else {
      await this.collection.doc(id.toString()).delete();
    }
  }
}
