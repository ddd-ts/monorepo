import { IEsEvent, ISerializer, ProjectedStreamReader } from "@ddd-ts/core";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { InMemoryProjectedStreamStorageLayer } from "./in-memory.projected-stream.storage-layer";

export class InMemoryProjectedStreamReader<
  Events extends IEsEvent,
> extends ProjectedStreamReader<Events> {
  constructor(database: InMemoryDatabase, serializer: ISerializer<Events>) {
    super(new InMemoryProjectedStreamStorageLayer(database), serializer);
  }
}
