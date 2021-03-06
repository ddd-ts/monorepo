import { Transaction } from "../../../projection/transaction/transaction";
import { Cashflow } from "../domain/cashflow/cashflow";

export abstract class CashflowStore {
  abstract save(cashflow: Cashflow, trx?: Transaction): Promise<void>;

  abstract load(): Promise<Cashflow>;
}
