import { Derive, Trait } from "@ddd-ts/traits";
import { Handler } from "../../handlers";
import { Deposited, Withdrawn } from "../account/account";
import { CashflowStore } from "./cashflow.store";
import {
  Transaction,
  TransactionPerformer,
} from "../../../components/transaction";
import { Lock } from "../../lock";
import { Description } from "../../handlers/description";

export class CashflowOnFlowHandler extends Derive(
  Handler.Base<
    Withdrawn | Deposited,
    {
      store: CashflowStore;
    }
  >(),
  Handler.OnProcessed,
  Handler.Context,
  Handler.Transaction<Transaction>(),
  Handler.LocalRetry(3, 10),
  Handler.LocalTimeout(500),
  Handler.ClaimTimeout(2000),
  Handler.Suspense,
  Handler.Parallel,
) {
  locks(event: Withdrawn | Deposited) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      eventId: event.id.serialize(),
    });
  }

  async handleOne(event: Withdrawn | Deposited) {
    await this.props.store.increment(
      event.payload.accountId,
      event.payload.amount,
    );
  }
}

// CashflowOnFlowHandler.debug(" ");
