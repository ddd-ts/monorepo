import { EventStreamStore, type IEsEvent, type INamed, type ISerializer } from "@ddd-ts/core";
import type { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";

export class InMemoryEventStreamStore<
  Event extends IEsEvent,
> extends EventStreamStore<Event> {
  constructor(database: InMemoryDatabase, serializer: ISerializer<Event>) {
    super(new InMemoryEventStreamStorageLayer(database), serializer);
  }
}
