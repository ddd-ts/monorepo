import { On, Projection, type Transaction } from "@ddd-ts/core";

import { Deposited } from "../domain/write/account/deposited.event";
import { Cashflow } from "../domain/read/cashflow/cashflow";
import { CashflowStore } from "./cashflow.store";

export class CashFlowProjection extends Projection("CashFlow", [Deposited]) {
  constructor(private readonly store: CashflowStore) {
    super({});
  }

  @On(Deposited)
  async onDeposited(fact: Deposited, trx?: Transaction) {
    const cashflow =
      (await this.store.load("global")) || new Cashflow("global", 0);

    cashflow.register(fact.payload.amount);

    await this.store.save(cashflow, trx);
  }
}
