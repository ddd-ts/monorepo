import { Derive, Trait } from "@ddd-ts/traits";
import { Handler } from "../../handlers";
import { Deposited, Withdrawn } from "../account/account";
import type { CashflowStore } from "./cashflow.store";
import {
  type Transaction,
  TransactionPerformer,
} from "../../../components/transaction";
import { Lock } from "../../lock";
import type { DerivedDescription, Description } from "../../handlers/description";

export class CashflowOnFlowHandlerParallel extends Derive(
  Handler.Base,
  Handler.WithProps<{ store: CashflowStore }>(),
  Handler.OnProcessed,
  Handler.Context,
  Handler.Transaction<Transaction>(),
  Handler.LocalRetry(2, 10),
  Handler.LocalTimeout(200),
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

export class CashflowOnFlowHandlerSequential extends Derive(
  Handler.Base,
  Handler.WithProps<{ store: CashflowStore }>(),
  Handler.OnProcessed,
  Handler.Context,
  Handler.Transaction<Transaction>(),
  // Handler.LocalRetry(2, 10),
  // Handler.LocalTimeout(200),
  // Handler.ClaimTimeout(2000),
  Handler.Sequential,
  Handler.Suspense,
) {
  locks(event: Withdrawn | Deposited) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
    });
  }

  async handleOne(event: Withdrawn | Deposited) {
    await this.props.store.increment(
      event.payload.accountId,
      event.payload.amount,
    );
  }

  static debug<T>(this: T, debug: DerivedDescription<T>): never {
    throw new Error("Debugging not implemented for this handler");
  }
}

// CashflowOnFlowHandlerSequential.debug(" ");
