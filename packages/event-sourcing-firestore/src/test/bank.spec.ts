import * as fb from "firebase-admin";
import { FirestoreEventStore } from "../firestore.event-store";

import { BankSuite } from "@ddd-ts/tests";
import { FirestoreCheckpoint } from "../firestore.checkpoint";
import { FirebaseTransactionPerformer } from "../firebase.transaction";
import { FirestoreStore } from "../firestore.store";
import { FirestoreSnapshotter } from "../firestore.snapshotter";
import { EsAggregatePersistorWithSnapshots } from "@ddd-ts/event-sourcing";

describe("Firestore Bank Test", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();
  const es = new FirestoreEventStore(firestore);
  const checkpoint = new FirestoreCheckpoint(firestore);
  const transactionPerformer = new FirebaseTransactionPerformer(es.firestore);

  BankSuite(
    es,
    checkpoint,
    transactionPerformer,
    (serializer, name) => {
      const Store = class extends FirestoreStore(name) {};
      const store = new Store(firestore, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer) => {
      const snapshotter = new FirestoreSnapshotter(firestore, serializer);
      const persistor = class extends EsAggregatePersistorWithSnapshots(
        AGGREGATE
      ) {};
      return new persistor(es, snapshotter);
    }
  );
});
