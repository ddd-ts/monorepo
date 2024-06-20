process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";

import type { EventSourced, Identifiable, ISerializer } from "@ddd-ts/core";
import type { HasTrait } from "@ddd-ts/traits";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { EsAggregateStoreSuite } from "@ddd-ts/tests";

import { NestedFirestoreEventStore } from "./firestore.event-store";
import { MakeNestedFirestoreEsAggregateStore } from "./firestore.es-aggregate-store";
import { NestedFirestoreSnapshotter } from "./firestore.snapshotter";

jest.setTimeout(10000);

describe("NestedFirestoreEventStore", () => {
  const app = fb.initializeApp({
    projectId: "demo-es",
  });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);
  const eventStore = new NestedFirestoreEventStore(firestore);

  function makeAggregateStore<
    T extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  >(
    AGGREGATE: T,
    eventSerializer: ISerializer<InstanceType<T>["changes"][number]>,
    serializer: ISerializer<InstanceType<T>>,
  ) {
    const snapshotter = new NestedFirestoreSnapshotter(firestore, serializer);
    const Store = MakeNestedFirestoreEsAggregateStore(AGGREGATE);
    return new Store(eventStore, transaction, eventSerializer, snapshotter);
  }

  EsAggregateStoreSuite(makeAggregateStore);
});
