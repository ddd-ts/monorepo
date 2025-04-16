import { DetachedEventBus } from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { BankSuite } from "@ddd-ts/tests";
import { InMemoryEventStreamStore } from "../event-store/in-memory.event-stream.store";
import { InMemorySnapshotter } from "../in-memory.snapshotter";
import { MakeInMemoryEsAggregateStore } from "../in-memory.es-aggregate-store";

describe("EventSourcingInMemory", () => {
  const es = new InMemoryEventStreamStore();
  const database = new InMemoryDatabase();
  const transaction = new InMemoryTransactionPerformer(database);
  const eventBus = new DetachedEventBus();

  BankSuite(
    eventBus,
    (serializer, name) => {
      const store = new InMemoryStore(name, database, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventSerializer) => {
      const snapshotter = new InMemorySnapshotter(
        AGGREGATE.name,
        database,
        serializer,
      );
      const Store = MakeInMemoryEsAggregateStore(AGGREGATE);

      const store = new Store(es, transaction, eventSerializer, snapshotter);
      store.publishEventsTo(eventBus);
      return store;
    },
  );
});
