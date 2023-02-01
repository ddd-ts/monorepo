import { Serializer, Store } from "@ddd-ts/model";
import {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  DocumentData,
  Transaction,
} from "firebase-admin/firestore";

export class FirestoreStore<Model, Id extends { toString(): string }>
  implements Store<Model, Id>
{
  _collection: CollectionReference;

  constructor(
    public readonly collection: string,
    public readonly firestore: Firestore,
    public readonly serializer: Serializer<Model>,
    public readonly converter?: FirestoreDataConverter<DocumentData>
  ) {
    if (this.converter) {
      this._collection = this.firestore
        .collection(collection)
        .withConverter(this.converter);
    } else {
      this._collection = this.firestore.collection(collection);
    }
  }

  async save(model: Model, trx?: Transaction): Promise<void> {
    const serialized = await this.serializer.serialize(model);
    const ref = this._collection.doc(
      this.serializer.getIdFromModel(model).toString()
    );

    trx ? trx.set(ref, serialized) : await ref.set(serialized);
  }

  async load(id: Id, trx?: Transaction): Promise<Model | undefined> {
    const ref = this._collection.doc(id.toString());

    const snapshot = trx ? await trx.get(ref) : await ref.get();

    if (!snapshot.exists) {
      return undefined;
    }

    return this.serializer.deserialize(snapshot.data() as any);
  }

  async loadAll(): Promise<Model[]> {
    const snapshot = await this._collection.get();
    return Promise.all(
      snapshot.docs.map((doc) => this.serializer.deserialize(doc.data() as any))
    );
  }

  async delete(id: Id): Promise<void> {
    await this._collection.doc(id.toString()).delete();
  }
}
