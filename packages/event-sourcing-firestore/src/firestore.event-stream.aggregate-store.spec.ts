process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import {
  EventStreamAggregateStoreSuite,
  IEventSourced,
  IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { FirestoreSnapshotter } from "./firestore.snapshotter";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";

jest.setTimeout(10000);

describe("FirestoreEventStreamAggregateStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const database = app.firestore();

  EventStreamAggregateStoreSuite({
    transaction: new FirestoreTransactionPerformer(database),
    streamStorageLayer: new FirestoreEventStreamStorageLayer(database),
    getSnapshotter: <T extends IEventSourced & IIdentifiable>(
      name: string,
      serializer: ISerializer<T>,
    ) => new FirestoreSnapshotter<T>(name, database, serializer),
    getStore: <T extends IIdentifiable>(
      name: string,
      serializer: ISerializer<T>,
    ) => new FirestoreStore<T>(database.collection(name), serializer),
  });
});
