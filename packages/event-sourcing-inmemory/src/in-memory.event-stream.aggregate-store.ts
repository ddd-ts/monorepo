import type { HasTrait } from "@ddd-ts/traits";
import {
  StreamId,
  type EventsOf,
  EventSourced,
  type Identifiable,
  type IEventBus,
  EventStreamStore,
  EventStreamAggregateStore,
  Named,
  type EventOf,
  type ISerializer,
  type IEventSourced,
  type IIdentifiable,
} from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { InMemorySnapshotter } from "./in-memory.snapshotter";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";

export const MakeInMemoryEventStreamAggregateStore = <
  A extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $InMemoryEventStreamAggregateStore extends InMemoryEventStreamAggregateStore<
    InstanceType<A>
  > {
    constructor(
      database: InMemoryDatabase,
      serializer: ISerializer<InstanceType<A>> &
        ISerializer<EventOf<InstanceType<A>>>,
      eventBus?: IEventBus,
    ) {
      const snapshotter = new InMemorySnapshotter<InstanceType<A>>(
        AGGREGATE.name,
        database,
        serializer,
      );
      super(database, serializer, snapshotter, eventBus);
    }

    loadFirst(event: EventsOf<A>[number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getStreamId(id: InstanceType<A>["id"]): StreamId {
      return StreamId.from(AGGREGATE.name, id.serialize());
    }
  };
};

export abstract class InMemoryEventStreamAggregateStore<
  A extends IEventSourced & IIdentifiable,
> extends EventStreamAggregateStore<A> {
  constructor(
    public readonly database: InMemoryDatabase,
    public readonly serializer: ISerializer<EventOf<A>>,
    public readonly snapshotter: InMemorySnapshotter<A>,
    public readonly eventBus?: IEventBus,
  ) {
    const storageLayer = new InMemoryEventStreamStorageLayer(database);
    const transaction = new InMemoryTransactionPerformer(database);
    const streamStore = new EventStreamStore<EventOf<A>>(
      storageLayer,
      serializer,
      eventBus,
    );
    super(streamStore, transaction as any, snapshotter);
  }
}
