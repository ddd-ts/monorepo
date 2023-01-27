import { Fact, Projection, Transaction } from "@ddd-ts/event-sourcing";
import { Account } from "../domain/write/account/account";
import { Deposited } from "../domain/write/account/deposited.event";
import { Cashflow } from "../domain/read/cashflow/cashflow";
import { CashflowStore } from "./cashflow.store";

export class CashFlowProjection extends Projection {
  constructor(private readonly store: CashflowStore) {
    super();
  }

  on = [Account];

  @Projection.on(Deposited)
  async onDeposited(fact: Fact<Deposited>, trx?: Transaction) {
    const cashflow =
      (await this.store.load("global")) || new Cashflow("global", 0);

    cashflow.register(fact.payload.amount);

    await this.store.save(cashflow, trx);
  }
}
