process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";

import { BankSuite } from "@ddd-ts/tests";
import { DetachedEventBus } from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";

import { FirestoreEventStreamStore } from "./firestore.event-stream-store";
import { FirestoreSnapshotter } from "./firestore.snapshotter";
import { MakeFirestoreEsAggregateStore } from "./firestore.es-aggregate-store";

jest.setTimeout(10_000);

describe("Firestore Bank Test", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);
  const es = new FirestoreEventStreamStore(firestore);
  const eventBus = new DetachedEventBus();

  BankSuite(
    eventBus,
    (serializer, name) => {
      const store = new FirestoreStore(name, firestore, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventsSerializers) => {
      const snapshotter = new FirestoreSnapshotter(
        AGGREGATE.name,
        firestore,
        serializer,
      );

      const Store = MakeFirestoreEsAggregateStore(AGGREGATE);
      const store = new Store(es, transaction, eventsSerializers, snapshotter);
      store.publishEventsTo(eventBus);
      return store;
    },
  );
});
