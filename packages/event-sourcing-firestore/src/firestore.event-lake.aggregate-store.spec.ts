process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import {
  EventLakeAggregateStoreSuite,
  IEventSourced,
  IIdentifiable,
  LakeId,
  type ISerializer,
} from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { FirestoreEventLakeAggregateStore } from "./firestore.event-lake.aggregate-store";

jest.setTimeout(10000);

describe("FirestoreEventLakeAggregateStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const database = app.firestore();

  class AggregateStore<
    T extends IEventSourced & IIdentifiable,
  > extends FirestoreEventLakeAggregateStore<T> {
    getLakeId(instance: T): LakeId {
      return LakeId.from(instance.constructor.name, instance.id.serialize());
    }
  }

  EventLakeAggregateStoreSuite({
    transaction: new FirestoreTransactionPerformer(database),
    getAggregateStore: (AGGREGATE, serializer, eventBus) => {
      return new AggregateStore(
        database.collection(AGGREGATE.name),
        serializer,
        eventBus,
      );
    },
    getStore: <T extends IIdentifiable>(
      name: string,
      serializer: ISerializer<T>,
    ) => new FirestoreStore<T>(database.collection(name), serializer),
  });
});
