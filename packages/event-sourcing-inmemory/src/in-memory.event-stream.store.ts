import {
  EventStreamStore,
  IEsEvent,
  INamed,
  SerializerRegistry,
} from "@ddd-ts/core";
import type { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";

export class InMemoryEventStreamStore<
  Events extends (IEsEvent & INamed)[],
> extends EventStreamStore<Events> {
  constructor(
    database: InMemoryDatabase,
    serializer: SerializerRegistry.For<Events>,
  ) {
    super(new InMemoryEventStreamStorageLayer(database), serializer);
  }
}
