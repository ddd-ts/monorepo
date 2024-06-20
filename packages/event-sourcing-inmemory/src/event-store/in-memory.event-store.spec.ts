import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import { InMemoryEventStore } from "./in-memory.event-store";
import type { HasTrait } from "@ddd-ts/traits";
import type { EventSourced, Identifiable } from "@ddd-ts/core";
import type { ISerializer } from "@ddd-ts/core";
import { InMemorySnapshotter } from "../in-memory.snapshotter";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { MakeInMemoryEsAggregateStore } from "../in-memory.es-aggregate-store";

describe("InMemoryEventStore", () => {
  const database = new InMemoryDatabase();
  const eventStore = new InMemoryEventStore();
  function makeAggregateStore<
    T extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  >(
    AGGREGATE: T,
    eventSerializer: ISerializer<InstanceType<T>["changes"][number]>,
    serializer: ISerializer<InstanceType<T>>,
  ) {
    const snapshotter = new InMemorySnapshotter(database, serializer);

    const Store = MakeInMemoryEsAggregateStore(AGGREGATE);

    return new Store(eventStore, eventSerializer, snapshotter);
  }
  EsAggregateStoreSuite(makeAggregateStore);
});
