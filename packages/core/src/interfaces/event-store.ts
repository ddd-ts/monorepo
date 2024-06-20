import type { AggregateStreamId } from "../components/aggregate-stream-id";
import type { IChange, IFact } from "./es-event";

export interface IEventStore {
  append(
    streamId: AggregateStreamId,
    changes: IChange[],
    expectedRevision: number,
  ): Promise<void>;
  read(streamId: AggregateStreamId, from?: number): AsyncIterable<IFact>;
}
