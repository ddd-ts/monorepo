process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";

import type { ISerializer, EventSourced, Identifiable } from "@ddd-ts/core";
import type { HasTrait } from "@ddd-ts/traits";
import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";

import { FlatFirestoreEventStore } from "./firestore.event-store";
import { MakeFlatFirestoreEsAggregateStore } from "./firestore.es-aggregate-store";
import { FlatFirestoreSnapshotter } from "./firestore.snapshotter";

jest.setTimeout(30000);
describe("FlatFirestoreEventStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);
  const eventStore = new FlatFirestoreEventStore(firestore);

  function makeAggregateStore<
    T extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  >(
    AGGREGATE: T,
    eventSerializer: ISerializer<InstanceType<T>["changes"][number]>,
    serializer: ISerializer<InstanceType<T>>,
  ) {
    const Store = MakeFlatFirestoreEsAggregateStore(AGGREGATE);
    const snapshotter = new FlatFirestoreSnapshotter(firestore, serializer);

    return new Store(eventStore, transaction, eventSerializer, snapshotter);
  }

  EsAggregateStoreSuite(makeAggregateStore);
});
