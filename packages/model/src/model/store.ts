import { Model, Transaction } from "../index";

export interface Store<M extends Model> {
  save(model: M, transaction?: Transaction): Promise<void>;
  load(id: M["id"], transaction?: Transaction): Promise<M | undefined>;
  loadMany(ids: M["id"][], transaction?: Transaction): Promise<M[]>;
  loadAll(transaction?: Transaction): Promise<M[]>;
  delete(id: M["id"], transaction?: Transaction): Promise<void>;
  streamAll(pageSize?: number): AsyncIterable<M>;
}
