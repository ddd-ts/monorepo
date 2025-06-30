import { Derive } from "@ddd-ts/traits";
import { Handler } from "../../handlers";
import { Deposited, Withdrawn } from "../account/account";
import { CashflowStore } from "./cashflow.store";
import { Transaction } from "../../../components/transaction";
import { Lock } from "../../lock";

export class CashflowOnFlowHandler extends Derive(
  Handler.Base,
  Handler.Store<CashflowStore>(),
  Handler.OnProcessed,
  Handler.Transaction<Transaction>(),
  Handler.Suspense,
  Handler.LocalTimeout(1000),
  Handler.ClaimTimeout(1000),
  Handler.LocalRetry(3, 10),
  Handler.SkipAfter(100),
  Handler.RetryInIsolationAfter(50),
  Handler.Parallel,
) {
  locks(event: Withdrawn | Deposited) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      eventId: event.id.serialize(),
    });
  }

  async handleOne(event: Withdrawn | Deposited, context: this["context"]) {
    console.log(`Handling ${event}`);
    await this.store.increment(
      event.payload.accountId,
      event.payload.amount,
      context,
    );
  }
}

// CashflowOnFlowHandler.debug("---------------------------------");
