import {
  LakeId,
  EventId,
  type ISerializedChange,
  type ISerializedFact,
} from "@ddd-ts/core";

import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";

export const serverTimestamp = fb.firestore.FieldValue.serverTimestamp;

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

  async append(lakeId: LakeId, changes: ISerializedChange[], trx: FirestoreTransaction) {
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

    const [start, end] = await Promise.all([
      startAfter ? collection.doc(startAfter.serialize()).get() : null,
      endAt ? collection.doc(endAt.serialize()).get() : null,
    ]);

    if (startAfter && !start?.exists) {
      throw new Error(`StartAfter event not found: ${startAfter}`);
    }

    if (endAt && !end?.exists) {
      throw new Error(`EndAt event not found: ${endAt}`);
    }

    let query = collection
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc");

    if(start){
      query = query.startAfter(start);
    }
    
    if(endAt){
      query = query.endAt(end);
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