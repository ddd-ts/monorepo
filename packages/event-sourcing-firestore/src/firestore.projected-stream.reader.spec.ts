process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { ProjectedStreamReaderSuite } from "@ddd-ts/core";

import { FirestoreEventLakeStorageLayer } from "./firestore.event-lake.storage-layer";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";
import { FirestoreProjectedStreamStorageLayer } from "./firestore.projected-stream.storage-layer";

jest.setTimeout(10000);

describe("FirestoreProjectedStreamReader", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  ProjectedStreamReaderSuite({
    transaction: new FirestoreTransactionPerformer(firestore) as any,
    lakeStorageLayer: new FirestoreEventLakeStorageLayer(firestore),
    streamStorageLayer: new FirestoreEventStreamStorageLayer(firestore),
    readerStorageLayer: new FirestoreProjectedStreamStorageLayer(firestore),
  });
});
