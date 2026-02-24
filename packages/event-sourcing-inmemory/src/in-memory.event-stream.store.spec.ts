import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";

import { EventStreamStoreSuite } from "@ddd-ts/core";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";

describe("FirestoreEventStreamStore", () => {
  const database = new InMemoryDatabase();
  const transaction = new InMemoryTransactionPerformer(database);

  EventStreamStoreSuite({
    transaction: transaction as any,
    streamStorageLayer: new InMemoryEventStreamStorageLayer(database),
  });
});
