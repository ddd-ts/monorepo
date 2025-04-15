import {
  StreamId,
  LakeId,
  EventId,
  type ISerializedChange,
  type ISerializedFact,
  IEventStreamStore,
} from "@ddd-ts/core";

import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";


export const serverTimestamp = fb.firestore.FieldValue.serverTimestamp;


export class FirestoreEventStreamStore implements IEventStreamStore {

  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter: fb.firestore.FirestoreDataConverter<fb.firestore.DocumentData> = new DefaultConverter(),
  ) {}

  getCollection(streamId: StreamId) {
    return this.firestore.collection("event-store")
      .doc(streamId.aggregateType)
      .collection("streams")
      .doc(streamId.aggregateId)
      .collection("events");
  }

  async append(streamId: StreamId, changes: ISerializedChange[], expectedRevision: number, trx: FirestoreTransaction) {
    const collection = this.getCollection(streamId);

    let revision = expectedRevision + 1;
    for (const change of changes) {
      trx.transaction.create(
        collection.doc(`${revision}`),
        this.converter.toFirestore({
          aggregateType: streamId.aggregateType,
          eventId: change.id,
          aggregateId: streamId.aggregateId,
          revision: revision,
          name: change.name,
          payload: change.payload,
          occurredAt: serverTimestamp(),
          version: change.version,
        }),
      );
      revision++;
    }
  }

  async *read(streamId: StreamId, startAt?: number): AsyncIterable<ISerializedFact> {
    const collection = this.getCollection(streamId);

    const query = collection
      .where("revision", ">=", startAt || 0)
      .orderBy("revision", "asc");

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = this.converter.fromFirestore(e);
      yield {
        id: data.eventId,
        revision: data.revision,
        name: data.name,
        $name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      };
    }
  }
}


export class FirestoreEventLakeStore {
  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter: fb.firestore.FirestoreDataConverter<fb.firestore.DocumentData> = new DefaultConverter(),
  ) {}


  getCollection(lakeId: LakeId) {
    return this.firestore
      .collection("event-store")
      .doc('Lakes')
      .collection(lakeId.shardType)
      .doc(lakeId.shardId)
      .collection("events");
  }

  append(lakeId: LakeId, changes: ISerializedChange[], trx: FirestoreTransaction) {
    const collection = this.getCollection(lakeId);

    let revision = 0;
    for (const change of changes) {
      trx.transaction.create(
        collection.doc(change.id),
        this.converter.toFirestore({
          eventId: change.id,
          name: change.name,
          payload: change.payload,
          occurredAt: serverTimestamp(),
          version: change.version,
          revision: revision,
        }),
      );
      revision++;
    }
  }

  async *read(lakeId: LakeId, startAfter?: EventId, endAt?: EventId): AsyncIterable<ISerializedFact> {
    const collection = this.getCollection(lakeId);

    const query = collection
      .where("eventId", ">=", startAfter || "")
      .orderBy("eventId", "asc")
      .limit(100);

    if (endAt) {
      query.where("eventId", "<=", endAt);
    }

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = this.converter.fromFirestore(e);
      yield {
        id: data.eventId,
        revision: data.revision,
        name: data.name,
        $name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      };
    }
  }
}