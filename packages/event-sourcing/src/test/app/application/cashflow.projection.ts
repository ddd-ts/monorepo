import { Fact } from "../../../event/event";
import { Projection } from "../../../projection/projection";
import { Transaction } from "../../../projection/transaction/transaction.old";
import { Account } from "../domain/account/account";
import { Deposited } from "../domain/account/deposited.event";
import { CashflowStore } from "./cashflow.store";

export class CashFlowProjection extends Projection {
  constructor(private readonly store: CashflowStore) {
    super();
  }

  AGGREGATE = Account;

  @Projection.on(Deposited)
  async onDeposited(fact: Fact<Deposited>, trx?: Transaction) {
    const cashflow = await this.store.load();

    cashflow.register(fact.payload.amount);

    await this.store.save(cashflow, trx);
  }
}
