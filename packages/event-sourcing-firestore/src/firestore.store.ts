import { AbstractConstructor } from "@ddd-ts/event-sourcing/src/es-aggregate-store/event-store";
import { ISerializer } from "@ddd-ts/event-sourcing/src/model/serializer";
import { Store } from "@ddd-ts/event-sourcing/src/model/store";

export function FirestoreStore<
  Model,
  Id extends { toString(): string },
  S extends Record<string, unknown> & { id: string }
>(
  collection: string,
  serializer: ISerializer<Model, Id, S>
): AbstractConstructor<Store<Model, Id>> {
  abstract class FirstoreStore implements Store<Model, Id> {
    static _collectionName = collection;
    _collection: FirebaseFirestore.CollectionReference;
    _serializer: ISerializer<Model, Id, S>;

    constructor(public firestore: FirebaseFirestore.Firestore) {
      this._collection = this.firestore.collection(collection);
      this._serializer = serializer;
    }

    async save(
      model: Model,
      trx?: FirebaseFirestore.Transaction
    ): Promise<void> {
      console.log("saving", model);
      const serialized = serializer.serialize(model);
      const ref = this._collection.doc(serialized.id);

      trx ? trx.set(ref, serialized) : await ref.set(serialized);
    }

    async load(
      id: Id,
      trx?: FirebaseFirestore.Transaction
    ): Promise<Model | undefined> {
      const ref = this._collection.doc(id.toString());

      const snapshot = trx ? await trx.get(ref) : await ref.get();

      if (!snapshot.exists) {
        return undefined;
      }

      return serializer.deserialize(snapshot.data() as S);
    }

    async loadAll(): Promise<Model[]> {
      const snapshot = await this._collection.get();
      return snapshot.docs.map((doc) =>
        serializer.deserialize(doc.data() as S)
      );
    }

    async delete(id: Id): Promise<void> {
      await this._collection.doc(id.toString()).delete();
    }
  }

  return FirstoreStore;
}
