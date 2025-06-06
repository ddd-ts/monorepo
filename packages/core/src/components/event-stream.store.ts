import {
  IEsEvent,
  IFact,
  ISerializedChange,
  ISerializedFact,
} from "../interfaces/es-event";
import { IEventBus } from "../interfaces/event-bus";
import { ISerializer } from "../interfaces/serializer";
import { EventCommitResult } from "./event-commit-result";
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
  ): Promise<EventCommitResult>;

  read(streamId: StreamId, from?: number): AsyncIterable<ISerializedFact>;
}

export class EventStreamStore<Event extends IEsEvent> {
  constructor(
    public readonly storageLayer: EventStreamStorageLayer,
    public readonly serializer: ISerializer<Event>,
    public readonly eventBus?: IEventBus,
  ) {}

  isLocalRevisionOutdatedError(error: unknown): boolean {
    return this.storageLayer.isLocalRevisionOutdatedError(error);
  }

  async append(
    streamId: StreamId,
    changes: Event[],
    expectedRevision: number,
    trx: Transaction,
  ) {
    const serialized = await Promise.all(
      changes.map((change) => this.serializer.serialize(change)),
    );
    const result = await this.storageLayer.append(
      streamId,
      serialized as any,
      expectedRevision,
      trx,
    );

    trx.onCommit(() => {
      for (const change of changes) {
        const fact = result.factualize(change);
        this.eventBus?.publish(fact);
      }
    });

    return result;
  }

  async *read(streamId: StreamId, from?: number) {
    for await (const serialized of this.storageLayer.read(streamId, from)) {
      yield (await this.serializer.deserialize(serialized)) as IFact<Event>;
    }
  }
}
