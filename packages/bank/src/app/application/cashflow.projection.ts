import { Fact, Projection, Transaction } from "@ddd-ts/event-sourcing";
import { Account } from "../domain/account/account";
import { Deposited } from "../domain/account/deposited.event";
import { Cashflow } from "../domain/cashflow/cashflow";
import { CashflowStore } from "./cashflow.store";

export class CashFlowProjection extends Projection {
  constructor(private readonly store: CashflowStore) {
    super();
  }

  AGGREGATE = Account;

  @Projection.on(Deposited)
  async onDeposited(fact: Fact<Deposited>, trx?: Transaction) {
    const cashflow =
      (await this.store.load("global")) || new Cashflow("global", 0);

    cashflow.register(fact.payload.amount);

    await this.store.save(cashflow, trx);
  }
}
