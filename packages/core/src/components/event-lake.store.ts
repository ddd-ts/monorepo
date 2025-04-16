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
import { LakeId } from "./stream-id";
import { Transaction } from "./transaction";

export interface EventLakeStorageLayer {
  append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: Transaction,
  ): Promise<EventReference[]>;

  read(
    lakeId: LakeId,
    startAfter?: EventReference,
    endAt?: EventReference,
  ): AsyncIterable<ISerializedFact>;
}

export class EventLakeStore<Events extends (IEsEvent & INamed)[]> {
  constructor(
    public readonly storageLayer: EventLakeStorageLayer,
    public readonly serializer: SerializerRegistry.For<Events>,
  ) {}

  async append(
    lakeId: LakeId,
    changes: IChange<Events[number]>[],
    trx: Transaction,
  ) {
    const serialized = await Promise.all(
      changes.map((change) => this.serializer.serialize(change)),
    );
    return this.storageLayer.append(lakeId, serialized as any, trx);
  }

  async *read(
    lakeId: LakeId,
    startAfter?: EventReference,
    endAt?: EventReference,
  ) {
    const lake = this.storageLayer.read(lakeId, startAfter, endAt);
    for await (const serialized of lake) {
      yield this.serializer.deserialize<IFact<Events[number]>>(serialized);
    }
  }
}
