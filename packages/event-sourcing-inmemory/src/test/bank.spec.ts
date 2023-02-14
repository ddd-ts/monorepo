import { EsAggregatePersistorWithSnapshots } from "@ddd-ts/event-sourcing";
import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
  InMemoryStore,
} from "@ddd-ts/store-inmemory";
import { BankSuite } from "@ddd-ts/tests";
import { InMemoryCheckpoint, InMemoryEventStore } from "..";
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
      const store = new InMemoryStore(name, database, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventSerializers) => {
      const persistor = class extends EsAggregatePersistorWithSnapshots(
        AGGREGATE
      ) {};
      const snapshotter = new InMemorySnapshotter(database, serializer);
      return new persistor(es, eventSerializers, snapshotter);
    }
  );
});
