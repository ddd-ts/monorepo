process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";
import { TestFirestoreEventStore } from "../firestore.event-store";

import { BankSuite } from "@ddd-ts/tests";
import { FirestoreCheckpoint } from "../firestore.checkpoint";
import { FirestoreSnapshotter } from "../firestore.snapshotter";
import { EsAggregatePersistorWithSnapshots } from "@ddd-ts/event-sourcing";
import {
  FirebaseTransactionPerformer,
  FirestoreStore,
} from "@ddd-ts/store-firestore";
import { AllEventSerializers } from "@ddd-ts/event-sourcing/dist/es-aggregate-store/es-aggregate.persistor";

describe("Firestore Bank Test", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();
  const es = new TestFirestoreEventStore(firestore);
  const checkpoint = new FirestoreCheckpoint(firestore);
  const transactionPerformer = new FirebaseTransactionPerformer(es.firestore);

  BankSuite(
    es,
    checkpoint,
    transactionPerformer,
    (serializer, name) => {
      const store = new FirestoreStore(name, firestore, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventsSerializers) => {
      const snapshotter = new FirestoreSnapshotter(firestore, serializer);
      const persistor = class extends EsAggregatePersistorWithSnapshots(
        AGGREGATE
      ) {};
      return new persistor(es, eventsSerializers, snapshotter);
    }
  );
});
