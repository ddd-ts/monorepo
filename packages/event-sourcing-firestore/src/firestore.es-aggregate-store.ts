import { HasTrait } from "@ddd-ts/traits";
import {
  AggregateStreamId,
  ConcurrencyError,
  EventSourced,
  type Identifiable,
  type IEsAggregateStore,
  type IEventBus,
  type SerializerRegistry,
} from "@ddd-ts/core";
import type {
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";

import type { FirestoreSnapshotter } from "./firestore.snapshotter";
import type { FirestoreEventStore } from "./firestore.event-store";

export const MakeFirestoreEsAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  E extends
    InstanceType<A>["changes"][number] = InstanceType<A>["changes"][number],
>(
  AGGREGATE: A,
) => {
  return class $FirestoreEsAggregateStore extends FirestoreEsAggregateStore<A> {
    loadFirst(event: E): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getAggregateStreamId(id: InstanceType<A>["id"]): AggregateStreamId {
      return new AggregateStreamId({
        aggregate: AGGREGATE.name,
        id: id.serialize(),
      });
    }
  };
};

export abstract class FirestoreEsAggregateStore<
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  E extends
    InstanceType<A>["changes"][number] = InstanceType<A>["changes"][number],
> implements IEsAggregateStore<InstanceType<A>>
{
  constructor(
    public readonly eventStore: FirestoreEventStore,
    public readonly transaction: FirestoreTransactionPerformer,
    public readonly eventsSerializer: SerializerRegistry.For<
      InstanceType<A>["changes"]
    >,
    public readonly snapshotter: FirestoreSnapshotter<InstanceType<A>>,
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
      const event = await this.eventsSerializer.deserialize(serialized);
      snapshot.load(event);
    }

    return snapshot;
  }

  async loadFromScratch(id: InstanceType<A>["id"]) {
    const streamId = this.getAggregateStreamId(id);

    let instance: InstanceType<A> | undefined = undefined;
    for await (const serialized of this.eventStore.read(streamId)) {
      const event = await this.eventsSerializer.deserialize(serialized);

      if (!instance) {
        instance = this.loadFirst(event);
      } else {
        instance.load(event);
      }
    }

    return instance;
  }

  async loadForce(id: InstanceType<A>["id"]) {
    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      return this.loadFromSnapshot(snapshot);
    }

    return this.loadFromScratch(id);
  }

  async load(id: InstanceType<A>["id"]) {
    // const lastEvent = await this.eventStore.getLastEvent(streamId);

    // if(snapshot && lastEvent && snapshot.acknowledgedRevision < lastEvent.revision) {
    //   return this.loadFromSnapshot(snapshot)
    // }

    /**
     * For now, we can just return the snapshot if it exists
     * because the the snapshot is kept up to date with the event store transactionally.
     *
     * Performing the revision check is very expensive when using a query to get the missing events (10x slower)
     *
     * In the future, when snapshot will be lagging behind the stream we could:
     * - Keep a transactionnal revision mutex for each stream, to know if the snapshot is up to date without having to snapshot the whole model
     * - Use a stale snapshot and let the model catch up with the stream on the next save ?
     * - Use a snapshot that is always up to date with the stream, but that is not transactionnal, and catch up with the stream on the next save ?
     */
    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      return snapshot;
    }

    return this.loadFromScratch(id);
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
      aggregates
        .filter((a) => a.changes.length)
        .map(async (aggregate) => ({
          aggregate: aggregate,
          streamId: this.getAggregateStreamId(aggregate.id),
          changes: [...aggregate.changes],
          serialized: await Promise.all(
            aggregate.changes.map((event) =>
              this.eventsSerializer.serialize(event),
            ),
          ),
          acknowledgedRevision: aggregate.acknowledgedRevision,
        })),
    );

    if (!toSave.length) {
      return;
    }

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

        await this.snapshotter.saveAll(
          toSave.map((save) => save.aggregate),
          trx,
        );
      });
    } catch (error: any) {
      const isDDDTSConcurrencyError = error instanceof ConcurrencyError;
      const isFirestoreConcurrencyError = "code" in error && error.code === 6;
      const hasAttempts = attempts > 0;

      const shouldRetry =
        (isFirestoreConcurrencyError || isDDDTSConcurrencyError) && hasAttempts;

      if (shouldRetry) {
        const pristines = await Promise.all(
          toSave.map(async ({ aggregate, changes }) => {
            const pristine = await this.loadForce(aggregate.id);
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

      console.error(
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          isDDDTSConcurrencyError,
          isFirestoreConcurrencyError,
          hasAttempts,
          events: toSave.map(({ serialized }) => serialized),
        }),
      );

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
    attempts = 30,
  ): Promise<void> {
    return this.saveAll([aggregate], trx, attempts);
  }
}
