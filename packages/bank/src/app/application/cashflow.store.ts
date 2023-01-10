import { Transaction } from "@ddd-ts/event-sourcing";
import { Store } from "@ddd-ts/event-sourcing/dist/model/store";
import { Cashflow } from "../domain/cashflow/cashflow";

export abstract class CashflowStore {
  abstract load(id: string, trx?: Transaction): Promise<Cashflow | undefined>;
  abstract save(model: Cashflow, trx?: Transaction): Promise<void>;
}
