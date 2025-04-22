import { HasTrait } from "@ddd-ts/traits";
import { IEsAggregateStore } from "../interfaces/es-aggregate-store";
import { IFact } from "../interfaces/es-event";
import { IEventBus } from "../interfaces/event-bus";
import { Store } from "../interfaces/store";
import { EventSourced, EventsOf } from "../traits/event-sourced";
import { Identifiable } from "../traits/identifiable";
import { EventStreamStore } from "./event-stream.store";
import { StreamId } from "./stream-id";
import { TransactionPerformer, Transaction } from "./transaction";

export const MakeEventStreamAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $EsAggregateStore extends EventStreamAggregateStore<A> {
    loadFirst(event: EventsOf<A>[number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getStreamId(id: InstanceType<A>["id"]): StreamId {
      return StreamId.from(AGGREGATE.name, id.serialize());
    }
  };
};

export abstract class EventStreamAggregateStore<
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
> implements IEsAggregateStore<InstanceType<A>>
{
  constructor(
    public readonly streamStore: EventStreamStore<EventsOf<A>>,
    public readonly transaction: TransactionPerformer,
    public readonly snapshotter: Store<InstanceType<A>>,
  ) {}

  abstract getStreamId(id: InstanceType<A>["id"]): StreamId;
  abstract loadFirst(event: IFact<EventsOf<A>[number]>): InstanceType<A>;

  _publishEventsTo?: IEventBus;
  publishEventsTo(eventBus: IEventBus) {
    this._publishEventsTo = eventBus;
  }

  async loadFromSnapshot(snapshot: InstanceType<A>) {
    const streamId = this.getStreamId(snapshot.id);
    const from = snapshot.acknowledgedRevision + 1;
    const stream = this.streamStore.read(streamId, from);

    for await (const fact of stream) {
      snapshot.load(fact);
    }

    return snapshot;
  }

  async loadFromScratch(id: InstanceType<A>["id"]) {
    const streamId = this.getStreamId(id);

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

  async loadForce(id: InstanceType<A>["id"]) {
    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      return this.loadFromSnapshot(snapshot);
    }

    return this.loadFromScratch(id);
  }

  async load(id: InstanceType<A>["id"]) {
    /**
     * For now, we can just return the snapshot if it exists
     * because the the snapshot is kept up to date with the event store transactionally.
     *
     * Performing the revision check is very expensive when using a query to get the missing events (10x slower)
     *
     * In the future, when snapshot will be lagging behind the stream we could:
     * - Keep a transactionnal revision mutex for each stream, to know if the snapshot is up to date without having to snapshot the whole model
     * - Use a stale snapshot and let the model catch up with the stream on the next save
     * - Use a snapshot that is always up to date with the stream, but that is not transactionnal, and catch up with the stream on the next save
     */
    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      return snapshot;
    }

    return this.loadFromScratch(id);
  }

  async saveAll(
    aggregates: InstanceType<A>[],
    parentTrx?: Transaction,
    attempts = 10,
  ): Promise<void> {
    const toSave = await Promise.all(
      aggregates
        .filter((a) => a.changes.length)
        .map(async (aggregate) => ({
          aggregate: aggregate,
          streamId: this.getStreamId(aggregate.id),
          changes: [...aggregate.changes],
          acknowledgedRevision: aggregate.acknowledgedRevision,
        })),
    );

    if (!toSave.length) {
      return;
    }

    try {
      await this.transaction.performWith(parentTrx, async (trx) => {
        for (const save of toSave) {
          await this.streamStore.append(
            save.streamId,
            save.changes,
            save.acknowledgedRevision,
            trx,
          );
        }

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
    } catch (error: unknown) {
      const isOutdated = this.streamStore.isLocalRevisionOutdatedError(error);
      const hasAttempts = attempts > 0;

      const shouldRetry = isOutdated && hasAttempts;

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
    trx?: Transaction,
    attempts = 30,
  ): Promise<void> {
    return this.saveAll([aggregate], trx, attempts);
  }
}
