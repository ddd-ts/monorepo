process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { EventLakeStoreSuite } from "@ddd-ts/core";
import { FirestoreEventLakeStorageLayer } from "./firestore.event-lake.storage-layer";

jest.setTimeout(10000);

describe("FirestoreEventLakeStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  EventLakeStoreSuite({
    transaction: new FirestoreTransactionPerformer(firestore) as any,
    lakeStorageLayer: new FirestoreEventLakeStorageLayer(firestore),
  });
});
