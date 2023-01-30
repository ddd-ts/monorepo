import { EsAggregatePersistorWithSnapshots } from "@ddd-ts/event-sourcing";
import { BankSuite } from "@ddd-ts/tests";
import {
  InMemoryCheckpoint,
  InMemoryDatabase,
  InMemoryEventStore,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "..";
import { InMemorySnapshotter } from "../in-memory.snapshotter";

describe("EventSourcingInMemory", () => {
  const es = new InMemoryEventStore();
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
