process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";

import { BankSuite } from "@ddd-ts/tests";
import { DetachedEventBus } from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";

import { NestedFirestoreEventStore } from "./firestore.event-store";
import { NestedFirestoreSnapshotter } from "./firestore.snapshotter";
import { MakeNestedFirestoreEsAggregateStore } from "./firestore.es-aggregate-store";

jest.setTimeout(10_000);

describe("NestedFirestore Bank Test", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);
  const es = new NestedFirestoreEventStore(firestore);
  const eventBus = new DetachedEventBus();

  BankSuite(
    eventBus,
    (serializer, name) => {
      const store = new FirestoreStore(name, firestore, serializer) as any;
      return store;
    },
    (AGGREGATE, serializer, eventsSerializers) => {
      const snapshotter = new NestedFirestoreSnapshotter(
        AGGREGATE.name,
        firestore,
        serializer,
      );

      const Store = MakeNestedFirestoreEsAggregateStore(AGGREGATE);
      const store = new Store(es, transaction, eventsSerializers, snapshotter);
      store.publishEventsTo(eventBus);
      return store;
    },
  );
});
