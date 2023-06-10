import { Transaction } from "../index";

export interface Store<Model extends { id: { toString(): string } }> {
  save(model: Model, trx?: Transaction): Promise<void>;
  load(id: Model["id"], trx?: Transaction): Promise<Model | undefined>;
  loadAll(): Promise<Model[]>;
  delete(id: Model["id"]): Promise<void>;
}
