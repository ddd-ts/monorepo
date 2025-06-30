import { Derive } from "@ddd-ts/traits";
import { Handler } from "../../handlers";
import { Deposited, Withdrawn } from "../account/account";
import { CashflowStore } from "./cashflow.store";
import { Transaction } from "../../../components/transaction";
import { Lock } from "../../lock";

export class CashflowOnFlowHandler extends Derive(
  Handler.Base,
  Handler.Debug,
  Handler.Store<CashflowStore>(),
  Handler.ClaimTimeout(2_000),
  Handler.SkipAfter(20),
  Handler.RetryInIsolationAfter(18),
  Handler.LocalTimeout(500),
  Handler.LocalRetry(3, 10),
  Handler.Parallel,
  Handler.Suspense,
  Handler.Transaction<Transaction>(),
  Handler.OnProcessed,
) {
  locks(event: Withdrawn | Deposited) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      eventId: event.id.serialize(),
    });
  }

  async handleOne(event: Withdrawn | Deposited, context: this["context"]) {
    // await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
    await this.store.increment(
      event.payload.accountId,
      event.payload.amount,
      context,
    );
  }
}

// CashflowOnFlowHandler.debug("---------------------------------");
