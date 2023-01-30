import { Transaction } from "@ddd-ts/model";
import { Cashflow } from "../domain/read/cashflow/cashflow";

export abstract class CashflowStore {
  abstract load(id: string, trx?: Transaction): Promise<Cashflow | undefined>;
  abstract save(model: Cashflow, trx?: Transaction): Promise<void>;
}
