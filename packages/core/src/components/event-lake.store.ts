import {
  IEsEvent,
  ISavedChange,
  ISerializedChange,
  ISerializedFact,
  ISerializedSavedChange,
} from "../interfaces/es-event";
import { IEventBus } from "../interfaces/event-bus";
import { ISerializer } from "../interfaces/serializer";
import { EventId } from "./event-id";
import { LakeId } from "./stream-id";
import { Transaction } from "./transaction";

export interface EventLakeStorageLayer {
  append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: Transaction,
  ): Promise<ISerializedSavedChange[]>;

  read(
    lakeId: LakeId,
    startAfter?: EventId,
    endAt?: EventId,
  ): AsyncIterable<ISerializedFact>;
}

export class EventLakeStore<Event extends IEsEvent> {
  constructor(
    public readonly storageLayer: EventLakeStorageLayer,
    public readonly serializer: ISerializer<Event, any>,
    public readonly eventBus?: IEventBus,
  ) {}

  async append(
    lakeId: LakeId,
    changes: Event[],
    trx: Transaction,
  ): Promise<ISavedChange<Event>[]> {
    const serialized = await Promise.all(
      changes.map((change) => this.serializer.serialize(change)),
    );

    const result = await this.storageLayer.append(lakeId, serialized, trx);

    const saved = (await Promise.all(
      result.map((r) => this.serializer.deserialize(r)),
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

  async *read(lakeId: LakeId, startAfter?: EventId, endAt?: EventId) {
    const lake = this.storageLayer.read(lakeId, startAfter, endAt);
    for await (const serialized of lake) {
      yield this.serializer.deserialize(serialized);
    }
  }
}
