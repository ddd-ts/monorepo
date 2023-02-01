import { Serializer, Store } from "@ddd-ts/model";
import { AbstractConstructor } from "@ddd-ts/types";
import {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  DocumentData,
  Transaction,
} from "firebase-admin/firestore";

export function FirestoreStore<Model, Id extends { toString(): string }>(
  collection: string
): AbstractConstructor<Store<Model, Id>> {
  abstract class FirstoreStore implements Store<Model, Id> {
    _collection: CollectionReference;

    constructor(
      public readonly firestore: Firestore,
      private readonly serializer: Serializer<Model>,
      private readonly converter?: FirestoreDataConverter<DocumentData>
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
      const serialized = this.serializer.serialize(model);
      const ref = this._collection.doc(serialized.id.toString());

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
      return snapshot.docs.map((doc) =>
        this.serializer.deserialize(doc.data() as any)
      );
    }

    async delete(id: Id): Promise<void> {
      await this.firestore.collection(collection).doc(id.toString()).delete();
    }
  }

  return FirstoreStore;
}
