process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import {
  EventStreamAggregateStoreSuite,
  type IIdentifiable,
  type ISerializer,
} from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { MakeFirestoreEventStreamAggregateStore } from "./firestore.event-stream.aggregate-store";

jest.setTimeout(10000);

describe("FirestoreEventStreamAggregateStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const database = app.firestore();

  EventStreamAggregateStoreSuite({
    transaction: new FirestoreTransactionPerformer(database) as any,
    getAggregateStore: (AGGREGATE, serializer, eventBus) => {
      const Store = MakeFirestoreEventStreamAggregateStore(AGGREGATE);
      return new Store(database, serializer, eventBus);
    },
    getStore: <T extends IIdentifiable>(
      name: string,
      serializer: ISerializer<T>,
    ) => new FirestoreStore<T>(database.collection(name), serializer),
  });
});
