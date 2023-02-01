import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import * as fb from "firebase-admin";
import { FirestoreEventStore } from "./firestore.event-store";

describe("FirestoreEventStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  EsAggregateStoreSuite(new FirestoreEventStore(firestore));
});
