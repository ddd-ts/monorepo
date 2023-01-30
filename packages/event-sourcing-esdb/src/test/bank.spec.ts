import { BankSuite } from "@ddd-ts/tests";
import { ESDBEventStore } from "../esdb.event-store";

import {
  InMemoryCheckpoint,
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
  InMemorySnapshotter,
} from "@ddd-ts/event-sourcing-inmemory";
import { EsAggregatePersistorWithSnapshots } from "@ddd-ts/event-sourcing";

describe("EventSourcingESDB", () => {
  const es = new ESDBEventStore();
  const database = new InMemoryDatabase();
  const checkpoint = new InMemoryCheckpoint(database);
  const transaction = new InMemoryTransactionPerformer(database);
  BankSuite(
    es,
    checkpoint,
    transaction,
    (serializer, name) => {
      const Store = class extends InMemoryStore(name) {};
      const store = new Store(database, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer) => {
      const persistor = class extends EsAggregatePersistorWithSnapshots(
        AGGREGATE
      ) {};
      const snapshotter = new InMemorySnapshotter(database, serializer);
      return new persistor(es, snapshotter);
    }
  );
});
