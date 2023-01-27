import { Store } from "@ddd-ts/event-sourcing";
import { AccountTransfers } from "../domain/read/accountTransfers/accountTransfers";
import { AccountId } from "../domain/write/account/account-id";

export interface AccountTransfersStore
  extends Store<AccountTransfers, AccountId> {}
