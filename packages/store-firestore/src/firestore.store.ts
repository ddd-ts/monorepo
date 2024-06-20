import {
  CollectionReference,
  Firestore,
  FirestoreDataConverter,
  DocumentData,
  QueryDocumentSnapshot,
  DocumentSnapshot,
} from "firebase-admin/firestore";

import { Store, ISerializer, type IIdentifiable } from "@ddd-ts/core";

import { FirestoreTransaction } from "./firestore.transaction";
import { batch, combine } from "./asyncTools";

export class FirestoreStore<M extends IIdentifiable> implements Store<M> {
  collection: CollectionReference;

  constructor(
    public readonly collectionName: string,
    public readonly firestore: Firestore,
    public readonly serializer: ISerializer<M>,
    public readonly converter?: FirestoreDataConverter<DocumentData>,
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
    trx?: FirestoreTransaction,
  ): Promise<M[]> {
    const result = trx ? await trx.transaction.get(query) : await query.get();

    return Promise.all(
      result.docs.map((doc: any) =>
        this.serializer.deserialize({ id: doc.id, ...doc.data() }),
      ),
    );
  }

  private async *streamPages(
    query: FirebaseFirestore.Query<any>,
    pageSize: number,
  ) {
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

  protected async *streamQuery(
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
    const ref = this.collection.doc(model.id.toString());

    trx ? trx.transaction.set(ref, serialized) : await ref.set(serialized);
  }

  async load(id: M["id"], trx?: FirestoreTransaction): Promise<M | undefined> {
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

  async loadAll(transaction?: FirestoreTransaction): Promise<M[]> {
    let docs: DocumentSnapshot[];

    if (transaction) {
      docs = await transaction.transaction.getAll();
    } else {
      ({ docs } = await this.collection.get());
    }
    return Promise.all(
      docs.map((doc) =>
        this.serializer.deserialize({ id: doc.id, ...(doc.data() as any) }),
      ),
    );
  }

  async delete(id: M["id"], trx?: FirestoreTransaction): Promise<void> {
    if (trx) {
      trx.transaction.delete(this.collection.doc(id.toString()));
    } else {
      await this.collection.doc(id.toString()).delete();
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

  async streamConcurrent(
    concurrency: number,
    pageSize: number,
    baseQuery?: FirebaseFirestore.Query<DocumentData>,
  ): Promise<AsyncIterable<M>> {
    const totalCount = await (baseQuery
      ? this.count(baseQuery)
      : this.countAll());
    const partSize = Math.ceil(totalCount / concurrency);
    const queries: FirebaseFirestore.Query<DocumentData>[] = [];

    for (let i = 0; i < concurrency; i += 1) {
      const offset = i * partSize;
      if (baseQuery) {
        queries.push(baseQuery.offset(offset).limit(partSize));
      } else {
        queries.push(this.collection.offset(i * partSize).limit(partSize));
      }
    }
    return combine(queries.map((query) => this.streamQuery(query, pageSize)));
  }
}
