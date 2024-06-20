import type { Store } from "@ddd-ts/core";
import { InMemoryDatabase, InMemoryStore } from "@ddd-ts/store-inmemory";

import { Account } from "../domain/write/account/account";
import { AccountSerializer } from "../infrastructure/account.serializer";

export interface AccountStore extends Store<Account> {}

export class InMemoryAccountStore extends InMemoryStore<Account> {
  constructor(database: InMemoryDatabase) {
    super("account", database, new AccountSerializer());
  }
}
