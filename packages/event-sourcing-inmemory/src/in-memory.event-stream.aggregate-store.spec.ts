import { EventStreamAggregateStoreSuite } from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { MakeInMemoryEventStreamAggregateStore } from "./in-memory.event-stream.aggregate-store";

describe("InMemoryEventStreamAggregateStore", () => {
  const database = new InMemoryDatabase();

  EventStreamAggregateStoreSuite({
    transaction: new InMemoryTransactionPerformer(database),
    getAggregateStore: (AGGREGATE, serializer, eventBus) => {
      const Store = MakeInMemoryEventStreamAggregateStore(AGGREGATE);
      return new Store(database, serializer, eventBus);
    },
    getStore: (name, serializer) =>
      new InMemoryStore(name, database, serializer),
  });
});
