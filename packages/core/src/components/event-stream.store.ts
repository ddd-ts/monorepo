import {
  IChange,
  IEsEvent,
  IFact,
  ISerializedChange,
  ISerializedFact,
} from "../interfaces/es-event";
import { INamed } from "../interfaces/named";
import { EventReference } from "./event-id";
import { SerializerRegistry } from "./serializer-registry";
import { StreamId } from "./stream-id";
import { Transaction } from "./transaction";

export interface EventStreamStorageLayer {
  append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: Transaction,
  ): Promise<EventReference[]>;

  read(streamId: StreamId, from?: number): AsyncIterable<ISerializedFact>;
}

export class EventStreamStore<Events extends (IEsEvent & INamed)[]> {
  constructor(
    public readonly storageLayer: EventStreamStorageLayer,
    public readonly serializer: SerializerRegistry.For<Events>,
  ) {}

  async append(
    streamId: StreamId,
    changes: IChange<Events[number]>[],
    expectedRevision: number,
    trx: Transaction,
  ) {
    const serialized = await Promise.all(
      changes.map((change) => this.serializer.serialize(change)),
    );
    return this.storageLayer.append(
      streamId,
      serialized as any,
      expectedRevision,
      trx,
    );
  }

  async *read(streamId: StreamId, from?: number) {
    for await (const serialized of this.storageLayer.read(streamId, from)) {
      yield await this.serializer.deserialize<IFact<Events[number]>>(
        serialized,
      );
    }
  }
}
