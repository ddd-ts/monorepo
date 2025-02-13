process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";

import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { Firestore } from "firebase-admin/firestore";
import { StoreSuite, MyElementSerializer, MyElement, MyElementId } from "../store.suite";
import type { Store } from "@ddd-ts/core";

class MyElementStore
  extends FirestoreStore<MyElement>
  implements Store<MyElement>
{
  constructor(database: Firestore) {
    super("my_collection", database, new MyElementSerializer());
  }

  loadEven() {
    return this.executeQuery(this.collection.where("even", "==", true));
  }
}

describe("FirestoreStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  function getStore() {
    return {
      store: new MyElementStore(firestore),
      transactionPerformer: new FirestoreTransactionPerformer(firestore),
    };
  }

  StoreSuite(getStore);

  it("streams all the database 10 by 10", async () => {
    const { store } = getStore();

    const elements = [...Array.from({ length: 100 }).keys()].map(
      (_, index) =>
        new MyElement(
          MyElementId.deserialize(index.toString()),
          `name-${index.toString()}`,
          index % 2 === 0,
        ),
    );
    await Promise.all(elements.map((e) => store.save(e)));
    const streamed: string[] = [];
    for await (const element of store.streamAll(10)) {
      streamed.push(element.name);
    }
    expect(streamed.length).toBe(100);
    expect(streamed.sort()).toEqual(
      [...Array.from({ length: 100 }).keys()]
        .map((_, index) => `name-${index.toString()}`)
        .sort(),
    );
  });
});
