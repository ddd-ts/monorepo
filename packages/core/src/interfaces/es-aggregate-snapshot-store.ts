import type { IEventSourced } from "./event-sourced";
import type { StreamId } from "../components/stream-id";
import type { IIdentifiable } from "./identifiable";

export interface IEsAggregateSnapshotStore<
  A extends IIdentifiable & IEventSourced,
> {
  load(id: StreamId): Promise<A | undefined>;
  save(aggregate: A): Promise<void>;
}
