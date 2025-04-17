import {
  IEsEvent,
  INamed,
  ProjectedStreamReader,
  SerializerRegistry,
} from "@ddd-ts/core";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { InMemoryProjectedStreamStorageLayer } from "./in-memory.projected-stream.storage-layer";

export class InMemoryProjectedStreamReader<
  Events extends (IEsEvent & INamed)[],
> extends ProjectedStreamReader<Events> {
  constructor(
    database: InMemoryDatabase,
    serializer: SerializerRegistry.For<Events>,
  ) {
    super(new InMemoryProjectedStreamStorageLayer(database), serializer);
  }
}
