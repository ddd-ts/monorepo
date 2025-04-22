import {
  IChange,
  IEsEvent,
  IFact,
  ISerializedChange,
  ISerializedFact,
} from "../interfaces/es-event";
import { ISerializer } from "../interfaces/serializer";
import { EventReference } from "./event-id";
import { StreamId } from "./stream-id";
import { Transaction } from "./transaction";

export interface EventStreamStorageLayer {
  isLocalRevisionOutdatedError(error: unknown): boolean;

  append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: Transaction,
  ): Promise<EventReference[]>;

  read(streamId: StreamId, from?: number): AsyncIterable<ISerializedFact>;
}

export class EventStreamStore<Event extends IEsEvent> {
  constructor(
    public readonly storageLayer: EventStreamStorageLayer,
    public readonly serializer: ISerializer<Event>,
  ) {}

  isLocalRevisionOutdatedError(error: unknown): boolean {
    return this.storageLayer.isLocalRevisionOutdatedError(error);
  }

  async append(
    streamId: StreamId,
    changes: IChange<Event>[],
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
      yield (await this.serializer.deserialize(serialized)) as IFact<Event>;
    }
  }
}
