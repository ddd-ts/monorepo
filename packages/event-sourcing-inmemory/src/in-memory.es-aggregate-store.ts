import { HasTrait } from "@ddd-ts/traits";
import {
  StreamId,
  ConcurrencyError,
  EventSourced,
  type IEsAggregateStore,
  type IEventBus,
  type Identifiable,
  type EventsOf,
} from "@ddd-ts/core";

import type { InMemoryEventStreamStore } from "./event-store/in-memory.event-stream.store";
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
    public readonly streamStore: InMemoryEventStreamStore<EventsOf<A>>,
    public readonly transaction: InMemoryTransactionPerformer,
    public readonly snapshotter?: InMemorySnapshotter<InstanceType<A>>,
  ) {}

  abstract getStreamId(id: InstanceType<A>["id"]): StreamId;
  abstract loadFirst(fact: EventsOf<A>[number]): InstanceType<A>;

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

      for await (const fact of stream) {
        snapshot.load(fact);
      }

      return snapshot;
    }

    let instance: InstanceType<A> | undefined = undefined;
    for await (const fact of this.streamStore.read(streamId)) {
      if (!instance) {
        instance = this.loadFirst(fact);
      } else {
        instance.load(fact);
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

  performTransaction(
    trx: InMemoryTransaction | undefined,
    callback: (trx: InMemoryTransaction) => Promise<void>,
  ) {
    return trx ? callback(trx) : this.transaction.perform(callback);
  }

  async save(
    aggregate: InstanceType<A>,
    parentTrx?: InMemoryTransaction,
    attempts = 10,
  ): Promise<void> {
    const streamId = this.getStreamId(aggregate.id);
    const changes = [...aggregate.changes];

    try {
      await this.performTransaction(parentTrx, async (trx) => {
        await this.streamStore.append(
          streamId,
          changes,
          aggregate.acknowledgedRevision,
          trx,
        );

        aggregate.acknowledgeChanges();
        await this.snapshotter?.save(aggregate, trx);

        if (!parentTrx) {
          trx.onCommit(async () => {
            if (this._publishEventsTo) {
              for (const event of changes) {
                await this._publishEventsTo.publish(event);
              }
            }
          });
        }
      });
    } catch (error) {
      if (error instanceof ConcurrencyError && attempts > 0) {
        const pristine = await this.load(aggregate.id);

        if (!pristine) {
          throw new Error("Invalid concurrency error, aggregate not found");
        }

        for (const change of changes) {
          pristine.apply(change);
        }

        return await this.save(pristine, parentTrx, attempts - 1);
      }

      throw error;
    }

    if (parentTrx) {
      for (const event of changes) {
        await this._publishEventsTo?.publish(event);
      }
    }
  }
}
