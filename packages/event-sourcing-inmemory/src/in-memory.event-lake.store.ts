import {
  IEsEvent,
  INamed,
  EventLakeStore,
  SerializerRegistry,
} from "@ddd-ts/core";
import type { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { InMemoryEventLakeStorageLayer } from "./in-memory.event-lake.storage-layer";

export class InMemoryEventLakeStore<
  Events extends (IEsEvent & INamed)[],
> extends EventLakeStore<Events> {
  constructor(
    database: InMemoryDatabase,
    serializer: SerializerRegistry.For<Events>,
  ) {
    super(new InMemoryEventLakeStorageLayer(database), serializer);
  }
}
