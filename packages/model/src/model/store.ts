import { Model, Transaction } from "../index";

export interface Store<M extends Model> {
  save(model: M, trx?: Transaction): Promise<void>;
  load(id: M['id'], trx?: Transaction): Promise<M | undefined>;
  loadAll(): Promise<M[]>;
  delete(id: M['id']): Promise<void>;
}
