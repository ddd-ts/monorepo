import { BankSuite } from "@ddd-ts/test-bank";
import { ESDBEventStore } from "../esdb.event-store";

import {
  InMemoryCheckpoint,
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "@ddd-ts/event-sourcing-inmemory";

describe("EventSourcingESDB", () => {
  const es = new ESDBEventStore();
  const database = new InMemoryDatabase();
  const checkpoint = new InMemoryCheckpoint(database);
  const transaction = new InMemoryTransactionPerformer(database);
  BankSuite(es, checkpoint, transaction, (serializer, name) => {
    const Store = class extends InMemoryStore(name) {};
    const store = new Store(database, serializer) as any;
    return store;
  });
});
