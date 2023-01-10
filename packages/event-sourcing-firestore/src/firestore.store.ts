import { Serializer } from "@ddd-ts/event-sourcing";
import { AbstractConstructor } from "@ddd-ts/event-sourcing/src/es-aggregate-store/event-store";
import { Store } from "@ddd-ts/event-sourcing/src/model/store";

export function FirestoreStore<Model, Id extends { toString(): string }>(
  collection: string
): AbstractConstructor<Store<Model, Id>> {
  abstract class FirstoreStore implements Store<Model, Id> {
    _collection: FirebaseFirestore.CollectionReference;

    constructor(
      public readonly firestore: FirebaseFirestore.Firestore,
      private readonly serializer: Serializer<Model>
    ) {
      this._collection = this.firestore.collection(collection);
    }

    async save(
      model: Model,
      trx?: FirebaseFirestore.Transaction
    ): Promise<void> {
      const serialized = this.serializer.serialize(model);
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

      return this.serializer.deserialize(snapshot.data() as any);
    }

    async loadAll(): Promise<Model[]> {
      const snapshot = await this._collection.get();
      return snapshot.docs.map((doc) =>
        this.serializer.deserialize(doc.data() as any)
      );
    }

    async delete(id: Id): Promise<void> {
      await this._collection.doc(id.toString()).delete();
    }
  }

  return FirstoreStore;
}
