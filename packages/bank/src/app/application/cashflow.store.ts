import { Transaction } from "@ddd-ts/event-sourcing";
import { Cashflow } from "../domain/cashflow/cashflow";

export abstract class CashflowStore {
  abstract load(id: string, trx?: Transaction): Promise<Cashflow | undefined>;
  abstract save(model: Cashflow, trx?: Transaction): Promise<void>;
}
