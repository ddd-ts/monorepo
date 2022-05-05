import { InMemoryTransaction } from "../../../projection/transaction/in-memory.transaction";
import { CashflowStore } from "../application/cashflow.store";
import { Cashflow } from "../domain/cashflow/cashflow";

export class InMemoryCashflowStore extends CashflowStore {
  private flow = 0;

  private transactions = new Map<string, number>();

  async save(cashflow: Cashflow, trx?: InMemoryTransaction) {
    if (trx) {
      this.transactions.set(trx.id, cashflow.flow);
    } else {
      this.flow = cashflow.flow;
    }

    trx?.onCommit(async () => {
      this.transactions.delete(trx.id);
      this.flow = cashflow.flow;
    });

    trx?.onRollback(async () => {
      this.transactions.delete(trx.id);
    });
  }

  async load(trx?: InMemoryTransaction) {
    if (trx) {
      if (this.transactions.has(trx.id)) {
        return new Cashflow(this.transactions.get(trx.id)!);
      }
    }

    return new Cashflow(this.flow);
  }

  clear() {
    this.flow = 0;
  }
}
