import type { IEventSourced } from "./event-sourced";
import type { AggregateStreamId } from "../components/aggregate-stream-id";
import type { IIdentifiable } from "./identifiable";

export interface IEsAggregateSnapshotStore<
  A extends IIdentifiable & IEventSourced,
> {
  load(id: AggregateStreamId): Promise<A | undefined>;
  save(aggregate: A): Promise<void>;
}
