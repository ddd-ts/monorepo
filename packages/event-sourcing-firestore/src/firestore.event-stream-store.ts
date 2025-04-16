import {
  StreamId,
  type ISerializedChange,
  type ISerializedFact,
  EventReference,
  ISerializedEventStreamStore,
  IEsEvent,
  INamed,
  IEventStreamStore,
  SerializerRegistry,
  IChange,
  IFact,
} from "@ddd-ts/core";

import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import * as fb from "firebase-admin";


export const serverTimestamp = fb.firestore.FieldValue.serverTimestamp;


export class FirestoreSerializedEventStreamStore implements ISerializedEventStreamStore {

  constructor(
    public readonly firestore: fb.firestore.Firestore,
    public readonly converter = new DefaultConverter(),
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
    const refs: EventReference[] = [];

    let revision = expectedRevision + 1;
    for (const change of changes) {
      const ref = collection.doc(`${revision}`);
    
      refs.push(new EventReference(ref.path)); 
      
      trx.transaction.create(
        ref,
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

    return refs;
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
        ref: e.ref.path,
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


export class FirestoreEventStreamStore<Events extends (IEsEvent & INamed)[]> implements IEventStreamStore<Events> {

  constructor(
    public readonly streamStore: FirestoreSerializedEventStreamStore,
    public readonly serializer: SerializerRegistry.For<Events>,
  ) {}

  async append(
    streamId: StreamId,
    changes: IChange<Events[number]>[],
    expectedRevision: number,
    trx: FirestoreTransaction,
  ) {
    const serialized = await Promise.all(changes.map((change) => this.serializer.serialize(change)));
    return this.streamStore.append(streamId, serialized as any, expectedRevision, trx);
  }

  async *read(streamId: StreamId, from?: number) {
    for await (const serialized of this.streamStore.read(streamId, from)) {
      yield await this.serializer.deserialize<IFact<Events[number]>>(serialized);
    }
  }
}
