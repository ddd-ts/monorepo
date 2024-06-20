import { Store } from "@ddd-ts/core";

import { AccountTransfers } from "../domain/read/accountTransfers/accountTransfers";

export interface AccountTransfersStore extends Store<AccountTransfers> {}
