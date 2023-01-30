import { Transaction } from "../index";

export interface Store<Model, Id> {
  save(model: Model, trx?: Transaction): Promise<void>;
  load(id: Id, trx?: Transaction): Promise<Model | undefined>;
  loadAll(): Promise<Model[]>;
  delete(id: Id): Promise<void>;
}
