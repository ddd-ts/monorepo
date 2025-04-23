import {
  EventLakeAggregateStoreSuite,
  IEventSourced,
  IIdentifiable,
  LakeId,
} from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { InMemoryEventLakeAggregateStore } from "./in-memory.event-lake.aggregate-store";

describe("InMemoryEventLakeAggregateStore", () => {
  const database = new InMemoryDatabase();

  class AggregateStore<
    T extends IEventSourced & IIdentifiable,
  > extends InMemoryEventLakeAggregateStore<T> {
    getLakeId(instance: T): LakeId {
      return LakeId.from(instance.constructor.name, instance.id.serialize());
    }
  }

  EventLakeAggregateStoreSuite({
    transaction: new InMemoryTransactionPerformer(database),
    getAggregateStore: (AGGREGATE, serializer, eventBus) => {
      return new AggregateStore<InstanceType<typeof AGGREGATE>>(
        database,
        AGGREGATE.name,
        serializer,
        eventBus,
      );
    },
    getStore: (name, serializer) =>
      new InMemoryStore(name, database, serializer),
  });
});
