import {
  EventStreamAggregateStoreSuite,
  IEventSourced,
  IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";
import { InMemorySnapshotter } from "./in-memory.snapshotter";

describe("InMemoryEventStreamAggregateStore", () => {
  const database = new InMemoryDatabase();

  EventStreamAggregateStoreSuite({
    transaction: new InMemoryTransactionPerformer(database),
    streamStorageLayer: new InMemoryEventStreamStorageLayer(database),
    getSnapshotter: <T extends IEventSourced & IIdentifiable>(
      name: string,
      serializer: ISerializer<T>,
    ) => new InMemorySnapshotter(name, database, serializer),
    getStore: <T extends IIdentifiable>(
      name: string,
      serializer: ISerializer<T>,
    ) => new InMemoryStore<T>(name, database, serializer),
  });
});
