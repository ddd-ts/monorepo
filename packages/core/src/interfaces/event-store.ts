import type { StreamId } from "../components/stream-id";
import { Transaction } from "../components/transaction";
import type { ISerializedChange, ISerializedFact } from "./es-event";

export interface IEventStreamStore {
  append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: Transaction
  ): Promise<void>;
  read(streamId: StreamId, from?: number): AsyncIterable<ISerializedFact>;
}
