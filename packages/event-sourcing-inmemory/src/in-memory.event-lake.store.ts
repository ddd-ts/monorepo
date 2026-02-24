import { type IEsEvent, EventLakeStore, type ISerializer } from "@ddd-ts/core";
import type { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { InMemoryEventLakeStorageLayer } from "./in-memory.event-lake.storage-layer";

export class InMemoryEventLakeStore<
  Event extends IEsEvent,
> extends EventLakeStore<Event> {
  constructor(database: InMemoryDatabase, serializer: ISerializer<Event>) {
    super(new InMemoryEventLakeStorageLayer(database), serializer);
  }
}
