import { HasTrait } from "@ddd-ts/traits";
import {
  AggregateStreamId,
  ConcurrencyError,
  EventSourced,
  type IEsAggregateStore,
  type IEventBus,
  type Identifiable,
  type ISerializer,
} from "@ddd-ts/core";

import type { InMemoryEventStore } from "./event-store/in-memory.event-store";
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
  return class $FirestoreEsAggregateStore extends InMemoryEsAggregateStore<A> {
    loadFirst(event: InstanceType<A>["changes"][number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getAggregateStreamId(id: InstanceType<A>["id"]): AggregateStreamId {
      return new AggregateStreamId({
        aggregate: AGGREGATE.name,
        id: id.toString(),
      });
    }
  };
};

export abstract class InMemoryEsAggregateStore<
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
> implements IEsAggregateStore<InstanceType<A>>
{
  constructor(
    public readonly eventStore: InMemoryEventStore,
    public readonly transaction: InMemoryTransactionPerformer,
    public readonly serializer: ISerializer<InstanceType<A>["changes"][number]>,
    public readonly snapshotter?: InMemorySnapshotter<InstanceType<A>>,
  ) {}

  abstract getAggregateStreamId(id: InstanceType<A>["id"]): AggregateStreamId;
  abstract loadFirst(
    event: InstanceType<A>["changes"][number],
  ): InstanceType<A>;

  _publishEventsTo?: IEventBus;
  publishEventsTo(eventBus: IEventBus) {
    this._publishEventsTo = eventBus;
  }

  async load(id: InstanceType<A>["id"]) {
    const streamId = this.getAggregateStreamId(id);

    const snapshot = await this.snapshotter?.load(streamId);

    if (snapshot) {
      const stream = this.eventStore.read(
        streamId,
        snapshot.acknowledgedRevision + 1,
      );

      for await (const serialized of stream) {
        const event = await this.serializer.deserialize(serialized as any);
        snapshot.load(event as any);
      }

      return snapshot;
    }

    let instance: InstanceType<A> | undefined = undefined;
    for await (const serialized of this.eventStore.read(streamId)) {
      const event = await this.serializer.deserialize(serialized as any);
      if (!instance) {
        instance = this.loadFirst(event as any);
      } else {
        instance.load(event as any);
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
    const streamId = this.getAggregateStreamId(aggregate.id);
    const changes = [...aggregate.changes];

    const serialized = await Promise.all(
      changes.map((event) => this.serializer.serialize(event)),
    );

    try {
      await this.eventStore.append(
        streamId,
        serialized as any,
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
