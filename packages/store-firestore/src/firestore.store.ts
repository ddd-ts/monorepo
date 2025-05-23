import {
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
  DocumentSnapshot,
} from "firebase-admin/firestore";

import {
  Store,
  ISerializer,
  type IIdentifiable,
  Serialized,
} from "@ddd-ts/core";

import { FirestoreTransaction } from "./firestore.transaction";
import { batch } from "./asyncTools";
import { DefaultConverter } from "./converter";

export class FirestoreStore<
  M extends IIdentifiable,
  S extends ISerializer<M> = ISerializer<M>,
> implements Store<M>
{
  public defaultConverter = new DefaultConverter();
  constructor(
    public readonly _collection: CollectionReference,
    public readonly serializer: S,
    public readonly $name?: string,
  ) {}

  get firestore() {
    return this._collection.firestore;
  }

  get collection() {
    return this._collection.withConverter(
      this.defaultConverter,
    ) as CollectionReference<Serialized<S>, Serialized<S>>;
  }

  async executeQuery(
    query: FirebaseFirestore.Query<any>,
    trx?: FirestoreTransaction,
  ): Promise<M[]> {
    const result = trx ? await trx.transaction.get(query) : await query.get();

    return Promise.all(
      result.docs.map((doc) =>
        this.serializer.deserialize({
          ...(this.$name ? { $name: this.$name } : {}),
          id: doc.id,
          ...doc.data(),
        }),
      ),
    );
  }

  async *streamPages(query: FirebaseFirestore.Query<any>, pageSize: number) {
    let last: DocumentSnapshot | undefined;
    let nextPagePromise:
      | Promise<FirebaseFirestore.QuerySnapshot<any>>
      | undefined;

    function getNextPagePromise(cursor: DocumentSnapshot | undefined) {
      return cursor
        ? query.limit(pageSize).startAfter(cursor).get()
        : query.limit(pageSize).get();
    }

    do {
      const paginatedQuery = nextPagePromise ?? getNextPagePromise(last);
      const { docs } = await paginatedQuery;
      last = docs[pageSize - 1];
      if (last) {
        nextPagePromise = getNextPagePromise(last);
      }
      for (const doc of docs) {
        yield doc;
      }
    } while (last);
  }

  async *streamQuery(
    query: FirebaseFirestore.Query<any>,
    pageSize?: number,
  ): AsyncIterable<M> {
    const finalPageSize = pageSize ?? 50;
    const stream =
      finalPageSize === 1
        ? (query.stream() as AsyncIterable<QueryDocumentSnapshot>)
        : this.streamPages(query, finalPageSize);
    for await (const docs of batch(stream, finalPageSize)) {
      const deserializedDocs = await Promise.all(
        docs.map((doc) =>
          this.serializer.deserialize({ id: doc.id, ...(doc.data() as any) }),
        ),
      );
      for (const deserializedDoc of deserializedDocs) {
        yield deserializedDoc;
      }
    }
  }

  async save(model: M, trx?: FirestoreTransaction): Promise<void> {
    const serialized = await this.serializer.serialize(model);

    const ref = this.collection.doc(model.id.serialize());

    trx
      ? trx.transaction.set(ref, serialized)
      : await ref.set(serialized as any);
  }

  async saveAll(models: M[], trx?: FirestoreTransaction): Promise<void> {
    await Promise.all(models.map((m) => this.save(m, trx)));
  }

  async load(id: M["id"], trx?: FirestoreTransaction): Promise<M | undefined> {
    const ref = this.collection.doc(id.serialize());

    const snapshot = trx ? await trx.transaction.get(ref) : await ref.get();

    if (!snapshot.exists) {
      return undefined;
    }

    return this.serializer.deserialize({
      ...(this.$name ? { $name: this.$name } : {}),
      id: id.serialize(),
      ...snapshot.data(),
    });
  }

  async loadAll(transaction?: FirestoreTransaction): Promise<M[]> {
    let docs: DocumentSnapshot[];

    if (transaction) {
      docs = await transaction.transaction.getAll();
    } else {
      ({ docs } = await this.collection.get());
    }
    return Promise.all(
      docs.map((doc) =>
        this.serializer.deserialize({
          ...(this.$name ? { $name: this.$name } : {}),
          id: doc.id,
          ...doc.data(),
        }),
      ),
    );
  }

  async delete(id: M["id"], trx?: FirestoreTransaction): Promise<void> {
    if (trx) {
      trx.transaction.delete(this.collection.doc(id.serialize()));
    } else {
      await this.collection.doc(id.serialize()).delete();
    }
  }

  async loadMany(ids: M["id"][], trx?: FirestoreTransaction): Promise<M[]> {
    const result = await Promise.all(ids.map((id) => this.load(id, trx)));
    return result.filter((m) => m !== undefined) as M[];
  }

  streamAll(pageSize?: number): AsyncIterable<M> {
    return this.streamQuery(this.collection, pageSize);
  }

  async countAll() {
    return (await this.collection.count().get()).data().count;
  }

  async count(query: FirebaseFirestore.Query<DocumentData>) {
    return (await query.count().get()).data().count;
  }
}
