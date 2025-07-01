import {
  Cursor,
  IEsEvent,
  IFact,
  ISavedChange,
  ISerializedSavedChange,
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

  async getCursor(savedChange: ISavedChange<Event>) {
    const serialized = await this.serializer.serialize(savedChange);
    return this.storage.getCursor(serialized as ISerializedSavedChange);
  }

  async get(cursor: Cursor) {
    const serialized = await this.storage.get(cursor);
    if (!serialized) {
      return undefined;
    }
    return this.serializer.deserialize(serialized) as unknown as Promise<
      IFact<Event>
    >;
  }

  async slice(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
    limit?: number,
  ) {
    const serialized = await this.storage.slice(
      projectedStream,
      shard,
      startAfter,
      endAt,
      limit,
    );
    return Promise.all(
      serialized.map((s) => this.serializer.deserialize(s)),
    ) as any;
  }

  async *read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
  ) {
    for await (const serialized of this.storage.read(
      projectedStream,
      shard,
      startAfter,
      endAt,
    )) {
      yield this.serializer.deserialize(serialized) as unknown as IFact<Event>;
    }
  }
}
