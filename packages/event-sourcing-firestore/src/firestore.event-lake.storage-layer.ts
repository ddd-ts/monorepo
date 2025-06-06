import {
  LakeId,
  EventId,
  type ISerializedChange,
  type ISerializedFact,
  EventReference,
  EventLakeStorageLayer,
  EventCommitResult,
} from "@ddd-ts/core";

import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";

export const serverTimestamp = fb.firestore.FieldValue.serverTimestamp;

export class FirestoreEventLakeStorageLayer implements EventLakeStorageLayer {
  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter = new DefaultConverter(),
  ) {}

  getCollection(lakeId: LakeId) {
    return this.firestore
      .collection("event-store")
      .doc("Lakes")
      .collection(lakeId.shardType)
      .doc(lakeId.shardId)
      .collection("events");
  }

  async append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: FirestoreTransaction,
  ) {
    const collection = this.getCollection(lakeId);

    const result = new EventCommitResult();

    let revision = 0;
    for (const change of changes) {
      const storageChange = {
        eventId: change.id,
        name: change.name,
        payload: change.payload,
        occurredAt: serverTimestamp(),
        version: change.version,
        revision: revision,
      };

      const ref = collection.doc(change.id);
      result.set(change.id, new EventReference(ref.path), revision);
      trx.transaction.create(ref, this.converter.toFirestore(storageChange));

      revision++;
    }

    return result;
  }

  async *read(
    lakeId: LakeId,
    startAfter?: EventId,
    endAt?: EventId,
  ): AsyncIterable<ISerializedFact> {
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

    if (start) {
      query = query.startAfter(start);
    }

    if (endAt) {
      query = query.endAt(end);
    }

    for await (const event of query.stream()) {
      const e = event as any as fb.firestore.QueryDocumentSnapshot<any>;
      const data = this.converter.fromFirestore(e);
      yield {
        id: data.eventId,
        ref: e.ref.path,
        revision: data.revision,
        name: data.name,
        $name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      } as ISerializedFact;
    }
  }
}
