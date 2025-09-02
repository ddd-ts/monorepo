import {
  IEsEvent,
  IFact,
  ISavedChange,
  ISerializedChange,
  ISerializedFact,
  ISerializedSavedChange,
} from "../interfaces/es-event";
import { IEventBus } from "../interfaces/event-bus";
import { ISerializer } from "../interfaces/serializer";
import { StreamId } from "./stream-id";
import { Transaction } from "./transaction";

export interface EventStreamStorageLayer {
  isLocalRevisionOutdatedError(error: unknown): boolean;

  append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: Transaction,
  ): Promise<ISerializedSavedChange[]>;

  read(streamId: StreamId, from?: number): AsyncIterable<ISerializedFact>;
}

export class EventStreamStore<Event extends IEsEvent> {
  constructor(
    public readonly storageLayer: EventStreamStorageLayer,
    public readonly serializer: ISerializer<Event, any>,
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
  ): Promise<ISavedChange<Event>[]> {
    const serialized = await Promise.all(
      changes.map((change) => this.serializer.serialize(change)),
    );

    const result = await this.storageLayer.append(
      streamId,
      serialized,
      expectedRevision,
      trx,
    );

    const saved = (await Promise.all(
      result.map((e) => this.serializer.deserialize(e)),
    )) as ISavedChange<Event>[];

    for (const save of saved) {
      const matching = changes.find((c) => c.id.equals(save.id));
      if (matching) {
        // Update the original event with revision and ref.
        // Although it should not be necessary when letting the lake publish events.
        (matching as any).revision = save.revision;
        (matching as any).ref = save.ref;

        // Update the saved change as well, this is the one being published.
        (saved as any).ref = save.ref;
      }
    }

    trx.onCommit(async () => {
      if (!this.eventBus) return;

      return Promise.all(saved.map((s) => this.eventBus?.publish(s)));
    });

    return saved;
  }

  async *read(streamId: StreamId, from?: number) {
    for await (const serialized of this.storageLayer.read(streamId, from)) {
      yield (await this.serializer.deserialize(serialized)) as IFact<Event>;
    }
  }
}
