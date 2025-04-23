process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

import * as fb from "firebase-admin";
import { Primitive, Shape } from "../../shape/dist";
import { FirestoreStore } from "./firestore.store";
import { AutoSerializer } from "@ddd-ts/core";

describe("FirestoreStore", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const database = app.firestore();

  class AccountId extends Primitive(String) {}
  class Account extends Shape({
    id: AccountId,
    balance: Number,
  }) {}

  class AccountSerializer extends AutoSerializer.First(Account) {}

  class FirestoreAccountStore extends FirestoreStore<Account> {
    constructor(database: fb.firestore.Firestore) {
      super(database.collection("accounts"), new AccountSerializer());
    }
  }

  const firestoreAccountStore = new FirestoreAccountStore(database);

  it("saves and retrieves an account", async () => {
    const account = new Account({ id: new AccountId("123"), balance: 100 });
    await firestoreAccountStore.save(account);

    const retrievedAccount = await firestoreAccountStore.load(account.id);
    expect(retrievedAccount).toEqual(account);
  });

  it("loads all accounts", async () => {
    const accounts = await firestoreAccountStore.loadAll();
    expect(accounts).toBeInstanceOf(Array);
    expect(accounts.length).toBeGreaterThan(0);
  });
});
