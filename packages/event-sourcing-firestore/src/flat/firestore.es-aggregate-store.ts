import { HasTrait } from "@ddd-ts/traits";
import {
  ConcurrencyError,
  EventSourced,
  type AggregateStreamId,
  type Identifiable,
  type IEsAggregateStore,
  type IEventBus,
  type ISerializer,
} from "@ddd-ts/core";
import { type FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";

import type { FlatFirestoreSnapshotter } from "./firestore.snapshotter";
import type { FlatFirestoreEventStore } from "./firestore.event-store";

export const MakeFlatFirestoreEsAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $FlatFirestoreEsAggregateStore extends FlatFirestoreEsAggregateStore<A> {
    loadFirst(event: InstanceType<A>["changes"][number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getAggregateStreamId(id: InstanceType<A>["id"]): AggregateStreamId {
      return AGGREGATE.getAggregateStreamId(id);
    }
  };
};

export abstract class FlatFirestoreEsAggregateStore<
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
> implements IEsAggregateStore<InstanceType<A>>
{
  constructor(
    public readonly eventStore: FlatFirestoreEventStore,
    public readonly transaction: FirestoreTransactionPerformer,
    public readonly serializer: ISerializer<InstanceType<A>["changes"][number]>,
    public readonly snapshotter?: FlatFirestoreSnapshotter<InstanceType<A>>,
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
      const revision = snapshot.acknowledgedRevision;
      const stream = this.eventStore.read(streamId, revision + 1);

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

  async save(aggregate: InstanceType<A>, attempts = 5): Promise<void> {
    const streamId = this.getAggregateStreamId(aggregate.id);
    const changes = [...aggregate.changes];

    const serialized = await Promise.all(
      changes.map((event) => this.serializer.serialize(event)),
    );

    const revision = aggregate.acknowledgedRevision;

    try {
      await this.transaction.perform(async (trx) => {
        await this.eventStore.append(
          streamId,
          serialized as any,
          revision,
          trx,
        );

        aggregate.acknowledgeChanges();
        await this.snapshotter?.save(aggregate, trx);

        trx.onCommit(async () => {
          for (const event of changes) {
            await this._publishEventsTo?.publish(event);
          }
        });
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

        return await this.save(pristine, attempts - 1);
      }

      throw error;
    }
  }
}
