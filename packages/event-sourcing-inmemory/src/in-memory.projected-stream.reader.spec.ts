import { ProjectedStreamReaderSuite } from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";

import { InMemoryEventLakeStorageLayer } from "./in-memory.event-lake.storage-layer";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";
import { InMemoryProjectedStreamStorageLayer } from "./in-memory.projected-stream.storage-layer";

describe("InMemoryProjectedStreamReader", () => {
  const database = new InMemoryDatabase();

  ProjectedStreamReaderSuite({
    transaction: new InMemoryTransactionPerformer(database),
    lakeStorageLayer: new InMemoryEventLakeStorageLayer(database),
    streamStorageLayer: new InMemoryEventStreamStorageLayer(database),
    readerStorageLayer: new InMemoryProjectedStreamStorageLayer(database),
  });
});
