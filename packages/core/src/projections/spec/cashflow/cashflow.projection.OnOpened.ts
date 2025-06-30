import { Derive } from "@ddd-ts/traits";
import { AccountOpened } from "../account/account";
import { CashflowStore } from "./cashflow.store";
import { Transaction } from "../../../components/transaction";
import { Handler } from "../../handlers";
import { Lock } from "../../lock";

export class CashflowOnOpenedHandler extends Derive(
  Handler.Base,
  Handler.Debug,
  Handler.Store<CashflowStore>(),
  Handler.Transaction<Transaction>(),
  Handler.OnProcessed,
  Handler.Suspense,
  Handler.LocalRetry(3, 100),
  Handler.LocalTimeout(3000),
  Handler.Parallel,
) {
  locks(event: AccountOpened) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
    });
  }

  async handleOne(event: AccountOpened, context: this["context"]) {
    await this.store.init(event.payload.accountId, context);
  }
}
