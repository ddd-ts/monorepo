import {
  EventReference,
  IEsEvent,
  ISerializer,
  ProjectedStream,
  ProjectedStreamReader,
} from "@ddd-ts/core";
import { Firestore } from "firebase-admin/firestore";
import { FirestoreProjectedStreamStorageLayer } from "./firestore.projected-stream.storage-layer";

export class FirestoreProjectedStreamReader<
  Event extends IEsEvent,
> extends ProjectedStreamReader<Event> {
  storage: FirestoreProjectedStreamStorageLayer;
  serializer: ISerializer<Event>;
  constructor(firestore: Firestore, serializer: ISerializer<Event>) {
    const storage = new FirestoreProjectedStreamStorageLayer(firestore);
    super(storage, serializer);
    this.storage = storage;
    this.serializer = serializer;
  }

  async get(reference: EventReference) {
    const serialized = await this.storage.get(reference);
    return this.serializer.deserialize(serialized);
  }

  async slice(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: EventReference,
    endAt?: EventReference,
  ) {
    const serialized = await this.storage.slice(
      projectedStream,
      shard,
      startAfter,
      endAt,
    );
    return Promise.all(serialized.map((s) => this.serializer.deserialize(s)));
  }
}
