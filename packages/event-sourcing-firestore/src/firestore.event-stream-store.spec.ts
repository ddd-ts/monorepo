process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { EventStreamStoreSuite } from "@ddd-ts/core";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";

jest.setTimeout(10000);

describe("FirestoreEventStreamStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  EventStreamStoreSuite({
    transaction: new FirestoreTransactionPerformer(firestore) as any,
    streamStorageLayer: new FirestoreEventStreamStorageLayer(firestore),
  });
});
