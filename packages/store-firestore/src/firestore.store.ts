import { Store, Model } from "@ddd-ts/model";
import {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
  FieldPath,
} from "firebase-admin/firestore";
import { FirestoreTransaction } from "./firestore.transaction";
import { ISerializer } from "@ddd-ts/serialization";

export class FirestoreStore<M extends Model>
  implements Store<M>
{
  collection: CollectionReference;

  constructor(
    public readonly collectionName: string,
    public readonly firestore: Firestore,
    public readonly serializer: ISerializer<M>,
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

  private getIdFromModel(m: M) {
    if (Object.getOwnPropertyNames(m.id).includes('serialize')) {
      if ('serialize' in m.id) {
        return m.id.serialize()
      }
    }
    return m.id.toString()
  }

  protected async executeQuery(
    query: FirebaseFirestore.Query<any>,
    trx?: FirestoreTransaction
  ): Promise<M[]> {
    const result = trx ? await trx.transaction.get(query) : await query.get();

    return Promise.all(
      result.docs.map((doc) =>
        this.serializer.deserialize({ id: doc.id, ...doc.data() })
      )
    );
  }

  protected async *streamQuery(
    query: FirebaseFirestore.Query<any>
  ): AsyncIterable<M> {
    const stream: AsyncIterable<QueryDocumentSnapshot> = query.stream() as any;
    for await (const doc of stream) {
      yield this.serializer.deserialize({ id: doc.id, ...doc.data() as any });
    }
  }

  async save(model: M, trx?: FirestoreTransaction): Promise<void> {
    const serialized = await this.serializer.serialize(model);
    const ref = this.collection.doc(this.getIdFromModel(model));

    trx ? trx.transaction.set(ref, serialized) : await ref.set(serialized);
  }

  async load(id: M['id'], trx?: FirestoreTransaction): Promise<M | undefined> {
    const ref = this.collection.doc(id.toString());

    const snapshot = trx ? await trx.transaction.get(ref) : await ref.get();

    if (!snapshot.exists) {
      return undefined;
    }

    return this.serializer.deserialize({
      id: id.toString(),
      ...(snapshot.data() as any),
    });
  }

  async loadAll(): Promise<M[]> {
    const snapshot = await this.collection.get();
    return Promise.all(
      snapshot.docs.map((doc) =>
        this.serializer.deserialize({ id: doc.id, ...(doc.data() as any) })
      )
    );
  }

  async delete(id: M['id'], trx?: FirestoreTransaction): Promise<void> {
    if (trx) {
      trx.transaction.delete(this.collection.doc(id.toString()));
    } else {
      await this.collection.doc(id.toString()).delete();
    }
  }

  async loadMany(ids: M['id'][], trx?: FirestoreTransaction): Promise<M[]> {
    const result = await Promise.all(ids.map(id => this.load(id, trx)))
    return result.filter(m => m !== undefined) as M[]
  }

  streamAll(): AsyncIterable<M> {
    return this.streamQuery(this.collection);
  }
}
