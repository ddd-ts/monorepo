import type { Transaction } from "../components/transaction";
import type { IIdentifiable } from "./identifiable";

export interface Store<Model extends IIdentifiable> {
  save(model: Model, transaction?: Transaction): Promise<void>;
  load(id: Model["id"], transaction?: Transaction): Promise<Model | undefined>;
  loadMany(ids: Model["id"][], transaction?: Transaction): Promise<Model[]>;
  loadAll(transaction?: Transaction): Promise<Model[]>;
  delete(id: Model["id"], transaction?: Transaction): Promise<void>;
  streamAll(pageSize?: number): AsyncIterable<Model>;
  countAll(): Promise<number>;
}
