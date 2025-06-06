import {
  IChange,
  IEsEvent,
  ISerializedChange,
  ISerializedFact,
} from "../interfaces/es-event";
import { IEventBus } from "../interfaces/event-bus";
import { ISerializer } from "../interfaces/serializer";
import { EventCommitResult } from "./event-commit-result";
import { EventReference } from "./event-id";
import { LakeId } from "./stream-id";
import { Transaction } from "./transaction";

export interface EventLakeStorageLayer {
  append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: Transaction,
  ): Promise<EventCommitResult>;

  read(
    lakeId: LakeId,
    startAfter?: EventReference,
    endAt?: EventReference,
  ): AsyncIterable<ISerializedFact>;
}

export class EventLakeStore<Event extends IEsEvent> {
  constructor(
    public readonly storageLayer: EventLakeStorageLayer,
    public readonly serializer: ISerializer<Event>,
    public readonly eventBus?: IEventBus,
  ) {}

  async append(lakeId: LakeId, changes: Event[], trx: Transaction) {
    const serialized = await Promise.all(
      changes.map((change) => this.serializer.serialize(change)),
    );

    const refs = await this.storageLayer.append(lakeId, serialized as any, trx);

    trx.onCommit(() => {
      for (const change of changes) {
        const fact = refs.factualize(change);
        this.eventBus?.publish(fact);
      }
    });

    return changes;
  }

  async *read(
    lakeId: LakeId,
    startAfter?: EventReference,
    endAt?: EventReference,
  ) {
    const lake = this.storageLayer.read(lakeId, startAfter, endAt);
    for await (const serialized of lake) {
      yield this.serializer.deserialize(serialized);
    }
  }
}
