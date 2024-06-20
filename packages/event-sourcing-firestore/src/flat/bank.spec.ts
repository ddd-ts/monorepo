process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";

import { BankSuite } from "@ddd-ts/tests";
import { DetachedEventBus } from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";

import { FlatFirestoreSnapshotter } from "../flat/firestore.snapshotter";
import { FlatFirestoreEventStore } from "../flat/firestore.event-store";
import { MakeFlatFirestoreEsAggregateStore } from "../flat/firestore.es-aggregate-store";

jest.setTimeout(35_000);

describe("FlatFirestore Bank Test", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);
  const es = new FlatFirestoreEventStore(firestore);
  const eventBus = new DetachedEventBus();

  BankSuite(
    eventBus,
    (serializer, name) => {
      const store = new FirestoreStore(name, firestore, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventsSerializers) => {
      const snapshotter = new FlatFirestoreSnapshotter(firestore, serializer);
      const Store = MakeFlatFirestoreEsAggregateStore(AGGREGATE);
      const store = new Store(es, transaction, eventsSerializers, snapshotter);
      store.publishEventsTo(eventBus);
      return store;
    },
  );
});
