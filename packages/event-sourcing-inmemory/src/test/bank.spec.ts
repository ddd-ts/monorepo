import { Serializer } from "@ddd-ts/event-sourcing";
import { BankSuite } from "@ddd-ts/test-bank";
import {
  InMemoryCheckpoint,
  InMemoryDatabase,
  InMemoryEventStore,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "..";

describe("EventSourcingInMemory", () => {
  const es = new InMemoryEventStore();
  const database = new InMemoryDatabase();
  const checkpoint = new InMemoryCheckpoint(database);
  const transaction = new InMemoryTransactionPerformer(database);

  BankSuite(es, checkpoint, transaction, (serializer, name) => {
    const Store = class extends InMemoryStore(name) {};
    const store = new Store(database, serializer) as any;
    return store;
  });
});
