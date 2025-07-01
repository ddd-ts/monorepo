import { Derive } from "@ddd-ts/traits";
import { AccountRenamed } from "../account/account";
import { CashflowStore } from "./cashflow.store";
import { Transaction } from "../../../components/transaction";
import { Handler } from "../../handlers";
import { Lock } from "../../lock";

export class CashflowOnRenamedHandler extends Derive(
  Handler.Base,
  Handler.Store<CashflowStore>(),
  Handler.Transaction<Transaction>(),
  Handler.LocalTimeout(2000),
  Handler.OnProcessed,
  Handler.BatchLast,
  Handler.Suspense,
) {
  locks(event: AccountRenamed) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      type: "rename",
    });
  }

  async handleLast(event: AccountRenamed, context: this["context"]) {
    await this.store.rename(
      event.payload.accountId,
      event.payload.newName,
      context,
    );
  }
}
