process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import * as fb from "firebase-admin";
import { TestFirestoreEventStore } from "./firestore.event-store";

describe("FirestoreEventStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();
  EsAggregateStoreSuite(new TestFirestoreEventStore(firestore));
});
