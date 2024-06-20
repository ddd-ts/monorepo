import { DetachedEventBus } from "@ddd-ts/core";
import { InMemoryDatabase, InMemoryStore } from "@ddd-ts/store-inmemory";
import { BankSuite } from "@ddd-ts/tests";
import { InMemoryEventStore } from "..";
import { InMemorySnapshotter } from "../in-memory.snapshotter";
import { MakeInMemoryEsAggregateStore } from "../in-memory.es-aggregate-store";

describe("EventSourcingInMemory", () => {
  const es = new InMemoryEventStore();
  const database = new InMemoryDatabase();
  const eventBus = new DetachedEventBus();

  BankSuite(
    eventBus,
    (serializer, name) => {
      const store = new InMemoryStore(name, database, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventSerializer) => {
      const snapshotter = new InMemorySnapshotter(database, serializer);
      const Store = MakeInMemoryEsAggregateStore(AGGREGATE);

      const store = new Store(es, eventSerializer, snapshotter);
      store.publishEventsTo(eventBus);
      return store;
    },
  );
});
