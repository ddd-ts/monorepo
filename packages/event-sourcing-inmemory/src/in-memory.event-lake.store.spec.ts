import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";

import { EventLakeStoreSuite } from "@ddd-ts/core";
import { InMemoryEventLakeStorageLayer } from "./in-memory.event-lake.storage-layer";

describe("FirestoreEventLakeStore", () => {
  const database = new InMemoryDatabase();
  const transaction = new InMemoryTransactionPerformer(database);

  EventLakeStoreSuite({
    transaction: transaction as any,
    lakeStorageLayer: new InMemoryEventLakeStorageLayer(database),
  });
});
