import { EventReference } from "../components/event-id";
import type { StreamId } from "../components/stream-id";
import { Transaction } from "../components/transaction";
import type {
  IChange,
  IFact,
  IEsEvent,
  ISerializedChange,
  ISerializedFact,
} from "./es-event";

export interface ISerializedEventStreamStore {
  append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: Transaction,
  ): Promise<EventReference[]>;
  read(streamId: StreamId, from?: number): AsyncIterable<ISerializedFact>;
}

export interface IEventStreamStore<Events extends IEsEvent[]> {
  append(
    streamId: StreamId,
    changes: IChange<Events[number]>[],
    expectedRevision: number,
    trx: Transaction,
  ): Promise<EventReference[]>;
  read(streamId: StreamId, from?: number): AsyncIterable<IFact<Events[number]>>;
}
