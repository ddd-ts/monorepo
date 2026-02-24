import type { HasTrait } from "@ddd-ts/traits";
import type { IEsAggregateStore } from "../interfaces/es-aggregate-store";
import type { IChange, IFact } from "../interfaces/es-event";
import type { Store } from "../interfaces/store";
import { type EventOf, EventSourced, type EventsOf } from "../traits/event-sourced";
import { Identifiable } from "../traits/identifiable";
import { EventStreamStore } from "./event-stream.store";
import { StreamId } from "./stream-id";
import { TransactionPerformer, type Transaction } from "./transaction";
import type { IEventSourced } from "../interfaces/event-sourced";
import type { IIdentifiable } from "../interfaces/identifiable";

export const MakeEventStreamAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $EsAggregateStore extends EventStreamAggregateStore<
    InstanceType<A>
  > {
    loadFirst(event: EventsOf<A>[number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getStreamId(id: InstanceType<A>["id"]): StreamId {
      return StreamId.from(AGGREGATE.name, id.serialize());
    }
  };
};

export abstract class EventStreamAggregateStore<
  A extends IEventSourced & IIdentifiable,
> implements IEsAggregateStore<A>
{
  constructor(
    public readonly streamStore: EventStreamStore<EventOf<A>>,
    public readonly transaction: TransactionPerformer,
    public readonly snapshotter: Store<A>,
  ) {}

  abstract getStreamId(id: A["id"]): StreamId;
  abstract loadFirst(event: IFact<EventOf<A>>): A;

  async loadFromSnapshot(snapshot: A) {
    const streamId = this.getStreamId(snapshot.id);
    const from = snapshot.acknowledgedRevision + 1;
    const stream = this.streamStore.read(streamId, from);

    for await (const fact of stream) {
      snapshot.load(fact);
    }

    return snapshot;
  }

  async loadFromScratch(id: A["id"]) {
    const streamId = this.getStreamId(id);

    let instance: A | undefined = undefined;
    for await (const fact of this.streamStore.read(streamId)) {
      if (!instance) {
        instance = this.loadFirst(fact);
      } else {
        instance.load(fact);
      }
    }

    return instance;
  }

  async loadForce(id: A["id"]) {
    const snapshot = await this.snapshotter?.load(id);

    if (snapshot) {
      return this.loadFromSnapshot(snapshot);
    }

    return this.loadFromScratch(id);
  }

  async load(id: A["id"]) {
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
    aggregates: A[],
    parentTrx?: Transaction,
    attempts = 10,
  ): Promise<void> {
    const toSave = await Promise.all(
      aggregates
        .filter((a) => a.changes.length)
        .map((aggregate) => ({
          aggregate: aggregate,
          streamId: this.getStreamId(aggregate.id),
          changes: [...aggregate.changes] as IChange<EventOf<A>>[],
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
  }

  async save(aggregate: A, trx?: Transaction, attempts = 30): Promise<void> {
    return this.saveAll([aggregate], trx, attempts);
  }
}
