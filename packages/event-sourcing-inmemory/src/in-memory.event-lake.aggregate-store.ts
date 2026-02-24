import {
  LakeId,
  type IEventBus,
  EventLakeStore,
  type EventOf,
  type ISerializer,
  type IEventSourced,
  type IIdentifiable,
  type IChange,
  EventSourced,
  Identifiable,
} from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransaction,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { InMemoryEventLakeStorageLayer } from "./in-memory.event-lake.storage-layer";
import type { HasTrait } from "@ddd-ts/traits";

export const MakeInMemoryEventLakeAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  abstract class $InMemoryEventLakeAggregateStore extends InMemoryEventLakeAggregateStore<
    InstanceType<A>
  > {
    constructor(
      public readonly database: InMemoryDatabase,
      public readonly collection: string,
      serializer: ISerializer<InstanceType<A>> &
        ISerializer<EventOf<InstanceType<A>>>,
      eventBus?: IEventBus,
    ) {
      super(database, collection, serializer, eventBus, AGGREGATE.name);
    }

    abstract getLakeId(instance: InstanceType<A>): LakeId;
  }

  return $InMemoryEventLakeAggregateStore;
};

export abstract class InMemoryEventLakeAggregateStore<
  A extends IEventSourced & IIdentifiable,
> extends InMemoryStore<A> {
  transaction: InMemoryTransactionPerformer;
  lakeStore: EventLakeStore<EventOf<A>>;
  constructor(
    public readonly database: InMemoryDatabase,
    public readonly collection: string,
    public readonly serializer: ISerializer<EventOf<A>> & ISerializer<A>,
    public readonly eventBus?: IEventBus,
    public readonly $name?: string,
  ) {
    const storageLayer = new InMemoryEventLakeStorageLayer(database);
    super(collection, database, serializer, $name);
    this.lakeStore = new EventLakeStore<EventOf<A>>(
      storageLayer,
      serializer,
      eventBus,
    );
    this.transaction = new InMemoryTransactionPerformer(database);
  }

  abstract getLakeId(instance: A): LakeId;

  override async save(aggregate: A, trx?: InMemoryTransaction) {
    const changes = aggregate.changes as IChange<EventOf<A>>[];

    await this.transaction.performWith(trx, async (trx) => {
      const lakeId = this.getLakeId(aggregate);

      await super.save(aggregate, trx);
      await this.lakeStore.append(lakeId, changes, trx);
      aggregate.clearChanges();
    });
  }
}
