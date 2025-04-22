import { HasTrait } from "@ddd-ts/traits";
import {
  StreamId,
  EventsOf,
  EventSourced,
  type Identifiable,
  type IEventBus,
  EventStreamStore,
  EventStreamAggregateStore,
  SerializerRegistry,
  Named,
} from "@ddd-ts/core";
import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { InMemorySnapshotter } from "./in-memory.snapshotter";
import { InMemoryEventStreamStorageLayer } from "./in-memory.event-stream.storage-layer";

export const MakeInMemoryEventStreamAggregateStore = <
  A extends HasTrait<typeof Named> &
    HasTrait<typeof EventSourced> &
    HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $InMemoryEventStreamAggregateStore extends InMemoryEventStreamAggregateStore<A> {
    constructor(
      database: InMemoryDatabase,
      serializer: SerializerRegistry.EventSourced<A>,
    ) {
      const snapshotter = new InMemorySnapshotter<InstanceType<A>>(
        AGGREGATE.name,
        database,
        serializer,
      );
      super(database, serializer, snapshotter);
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
  A extends HasTrait<typeof Named> &
    HasTrait<typeof EventSourced> &
    HasTrait<typeof Identifiable>,
> extends EventStreamAggregateStore<A> {
  constructor(
    public readonly database: InMemoryDatabase,
    public readonly serializer: SerializerRegistry.EventSourced<A>,
    public readonly snapshotter: InMemorySnapshotter<InstanceType<A>>,
  ) {
    const storageLayer = new InMemoryEventStreamStorageLayer(database);
    const transaction = new InMemoryTransactionPerformer(database);
    const streamStore = new EventStreamStore<EventsOf<A>>(
      storageLayer,
      serializer,
    );
    super(streamStore, transaction, snapshotter);
  }
}
