import type { Transaction } from "../components/transaction";
import type { IEventSourced } from "./event-sourced";
import type { IIdentifiable } from "./identifiable";

export interface IEsAggregateStore<A extends IIdentifiable & IEventSourced> {
  load(id: A["id"]): Promise<A | undefined>;
  save(aggregate: A, trx?: Transaction): Promise<void>;
  saveAll(aggregates: A[], trx?: Transaction): Promise<void>;
}
