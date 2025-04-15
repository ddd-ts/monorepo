import { HasTrait } from "@ddd-ts/traits";
import {
  StreamId,
  ConcurrencyError,
  EventSourced,
  type IEsAggregateStore,
  type IEventBus,
  type Identifiable,
  type SerializerRegistry,
  type EventOf,
  type EventsOf,
  ISerializedChange,
} from "@ddd-ts/core";

import type { InMemoryEventStreamStore } from "./event-store/in-memory.event-stream-store";
import type { InMemorySnapshotter } from "./in-memory.snapshotter";
import type {
  InMemoryTransaction,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";

export const MakeInMemoryEsAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $InMemoryEsAggregateStore extends InMemoryEsAggregateStore<A> {
    loadFirst(event: EventsOf<A>[number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getStreamId(id: InstanceType<A>["id"]): StreamId {
      return StreamId.from(AGGREGATE.name, id.serialize());
    }
  };
};

export abstract class InMemoryEsAggregateStore<
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
> implements IEsAggregateStore<InstanceType<A>>
{
  constructor(
    public readonly streamStore: InMemoryEventStreamStore,
    public readonly transaction: InMemoryTransactionPerformer,
    public readonly eventSerializer: SerializerRegistry.For<EventsOf<A>>,
    public readonly snapshotter?: InMemorySnapshotter<InstanceType<A>>,
  ) {}

  abstract getStreamId(id: InstanceType<A>["id"]): StreamId;
  abstract loadFirst(event: EventOf<A>): InstanceType<A>;

  _publishEventsTo?: IEventBus;
  publishEventsTo(eventBus: IEventBus) {
    this._publishEventsTo = eventBus;
  }

  async load(id: InstanceType<A>["id"]) {
    const streamId = this.getStreamId(id);

    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      const stream = this.streamStore.read(
        streamId,
        snapshot.acknowledgedRevision + 1,
      );

      for await (const serialized of stream) {
        const event =
          await this.eventSerializer.deserialize<EventOf<A>>(serialized);
        snapshot.load(event);
      }

      return snapshot;
    }

    let instance: InstanceType<A> | undefined = undefined;
    for await (const serialized of this.streamStore.read(streamId)) {
      const event =
        await this.eventSerializer.deserialize<EventOf<A>>(serialized);
      if (!instance) {
        instance = this.loadFirst(event);
      } else {
        instance.load(event);
      }
    }

    return instance;
  }

  async saveAll(
    aggregates: InstanceType<A>[],
    trx?: InMemoryTransaction,
    attempts = 10,
  ): Promise<void> {
    for (const aggregate of aggregates) {
      await this.save(aggregate, trx, attempts);
    }
  }

  async save(
    aggregate: InstanceType<A>,
    trx?: InMemoryTransaction,
    attempts = 10,
  ): Promise<void> {

    if(!trx){
      return await this.transaction.perform(async (trx) => {
        return await this.save(aggregate, trx, attempts);
      });
    }
    const streamId = this.getStreamId(aggregate.id);
    const changes = [...aggregate.changes];

    const serialized = await Promise.all(
      changes.map((event) => this.eventSerializer.serialize(event)),
    );

    try {
      await this.streamStore.append(
        streamId,
        serialized as ISerializedChange[],
        aggregate.acknowledgedRevision,
        trx,
      );

      aggregate.acknowledgeChanges();
      await this.snapshotter?.save(aggregate);
    } catch (error) {
      if (error instanceof ConcurrencyError && attempts > 0) {
        const pristine = await this.load(aggregate.id);

        if (!pristine) {
          throw new Error("Invalid concurrency error, aggregate not found");
        }

        for (const change of changes) {
          pristine.apply(change);
        }

        return await this.save(pristine, trx, attempts - 1);
      }

      throw error;
    }
    for (const event of changes) {
      await this._publishEventsTo?.publish(event);
    }
  }
}
