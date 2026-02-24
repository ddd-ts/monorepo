import { Derive } from "@ddd-ts/traits";
import { AccountRenamed } from "../account/account";
import type { CashflowStore } from "./cashflow.store";
import type { Transaction } from "../../../components/transaction";
import { Handler } from "../../handlers";
import { Lock } from "../../lock";

export class CashflowOnRenamedHandler extends Derive(
  Handler.Base,
  Handler.WithProps<{ store: CashflowStore }>(),
  Handler.OnProcessed,
  Handler.Context,
  Handler.Transaction<Transaction>(),
  Handler.LocalTimeout(2000),
  Handler.Suspense,
  Handler.BatchLast,
) {
  locks(event: AccountRenamed) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      type: "rename",
    });
  }

  async handleLast(event: AccountRenamed) {
    await this.props.store.rename(
      event.payload.accountId,
      event.payload.newName,
    );
  }
}
