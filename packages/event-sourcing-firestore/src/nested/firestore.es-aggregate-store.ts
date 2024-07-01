import { HasTrait } from "@ddd-ts/traits";
import {
  AggregateStreamId,
  ConcurrencyError,
  EventSourced,
  type Identifiable,
  type IEsAggregateStore,
  type IEventBus,
  type ISerializer,
} from "@ddd-ts/core";
import type {
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";

import type { NestedFirestoreSnapshotter } from "./firestore.snapshotter";
import type { NestedFirestoreEventStore } from "./firestore.event-store";

export const MakeNestedFirestoreEsAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $NestedFirestoreEsAggregateStore extends NestedFirestoreEsAggregateStore<A> {
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

export abstract class NestedFirestoreEsAggregateStore<
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
> implements IEsAggregateStore<InstanceType<A>>
{
  constructor(
    public readonly eventStore: NestedFirestoreEventStore,
    public readonly transaction: FirestoreTransactionPerformer,
    public readonly serializer: ISerializer<InstanceType<A>["changes"][number]>,
    public readonly snapshotter?: NestedFirestoreSnapshotter<InstanceType<A>>,
  ) {}

  abstract getAggregateStreamId(id: InstanceType<A>["id"]): AggregateStreamId;
  abstract loadFirst(
    event: InstanceType<A>["changes"][number],
  ): InstanceType<A>;

  _publishEventsTo?: IEventBus;
  publishEventsTo(eventBus: IEventBus) {
    this._publishEventsTo = eventBus;
  }

  async loadFromSnapshot(snapshot: InstanceType<A>) {
    const streamId = this.getAggregateStreamId(snapshot.id);

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

  async load(id: InstanceType<A>["id"]) {
    const streamId = this.getAggregateStreamId(id);

    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      return this.loadFromSnapshot(snapshot);
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

  performTransaction(
    trx: FirestoreTransaction | undefined,
    callback: (trx: FirestoreTransaction) => Promise<void>,
  ) {
    return trx ? callback(trx) : this.transaction.perform(callback);
  }

  async saveAll(
    aggregates: InstanceType<A>[],
    parentTrx?: FirestoreTransaction,
    attempts = 10,
  ): Promise<void> {
    const toSave = await Promise.all(
      aggregates.map(async (aggregate) => ({
        aggregate: aggregate,
        streamId: this.getAggregateStreamId(aggregate.id),
        changes: [...aggregate.changes],
        serialized: await Promise.all(
          aggregate.changes.map((event) => this.serializer.serialize(event)),
        ),
        acknowledgedRevision: aggregate.acknowledgedRevision,
      })),
    );

    try {
      await this.performTransaction(parentTrx, async (trx) => {
        await this.eventStore.bulkAppend(
          toSave.map((save) => ({
            streamId: save.streamId,
            changes: save.serialized as any,
            expectedRevision: save.acknowledgedRevision,
          })),
          trx,
        );

        for (const save of toSave) {
          save.aggregate.acknowledgeChanges();
        }

        if (!parentTrx) {
          trx.onCommit(async () => {
            if (this._publishEventsTo) {
              for (const { changes } of toSave) {
                for (const event of changes) {
                  await this._publishEventsTo.publish(event);
                }
              }
            }
          });
        }

        await Promise.all(
          toSave.map((save) => this.snapshotter?.save(save.aggregate, trx)),
        );
      });
    } catch (error) {
      if (error instanceof ConcurrencyError && attempts > 0) {
        const pristines = await Promise.all(
          toSave.map(async ({ aggregate, changes }) => {
            const pristine = await this.load(aggregate.id);
            if (!pristine) {
              throw new Error("Invalid concurrency error, aggregate not found");
            }

            for (const change of changes) {
              pristine.apply(change);
            }

            return pristine;
          }),
        );

        return await this.saveAll(pristines, parentTrx, attempts - 1);
      }

      throw error;
    }

    if (parentTrx) {
      parentTrx.onCommit(async () => {
        if (this._publishEventsTo) {
          for (const { changes } of toSave) {
            for (const event of changes) {
              await this._publishEventsTo.publish(event);
            }
          }
        }
      });
    }
  }

  async save(
    aggregate: InstanceType<A>,
    trx?: FirestoreTransaction,
    attempts = 10,
  ): Promise<void> {
    return this.saveAll([aggregate], trx, attempts);
  }
}
