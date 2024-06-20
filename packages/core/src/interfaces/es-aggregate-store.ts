import type { IEventSourced } from "./event-sourced";
import type { IIdentifiable } from "./identifiable";

export interface IEsAggregateStore<A extends IIdentifiable & IEventSourced> {
  load(id: A["id"]): Promise<A | undefined>;
  save(aggregate: A): Promise<void>;
}
