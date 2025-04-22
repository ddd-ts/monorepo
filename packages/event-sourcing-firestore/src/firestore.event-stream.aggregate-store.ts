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
  ISerializer,
} from "@ddd-ts/core";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";

import { FirestoreSnapshotter } from "./firestore.snapshotter";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export const MakeFirestoreEventStreamAggregateStore = <
  A extends HasTrait<typeof Named> &
    HasTrait<typeof EventSourced> &
    HasTrait<typeof Identifiable>,
>(
  AGGREGATE: A,
) => {
  return class $FirestoreEventStreamAggregateStore extends FirestoreEventStreamAggregateStore<A> {
    constructor(
      firestore: Firestore,
      serializer: SerializerRegistry.EventSourced<A>,
    ) {
      const snapshotter = new FirestoreSnapshotter<InstanceType<A>>(
        AGGREGATE.name,
        firestore,
        serializer,
      );
      super(firestore, serializer, snapshotter);
    }

    loadFirst(event: EventsOf<A>[number]): InstanceType<A> {
      return AGGREGATE.loadFirst(event);
    }

    getStreamId(id: InstanceType<A>["id"]): StreamId {
      return StreamId.from(AGGREGATE.name, id.serialize());
    }
  };
};

export abstract class FirestoreEventStreamAggregateStore<
  A extends HasTrait<typeof Named> &
    HasTrait<typeof EventSourced> &
    HasTrait<typeof Identifiable>,
> extends EventStreamAggregateStore<A> {
  constructor(
    public readonly firestore: Firestore,
    public readonly serializer: SerializerRegistry.EventSourced<A>,
    public readonly snapshotter: FirestoreSnapshotter<InstanceType<A>>,
  ) {
    const storageLayer = new FirestoreEventStreamStorageLayer(firestore);
    const transaction = new FirestoreTransactionPerformer(firestore);
    const streamStore = new EventStreamStore<EventsOf<A>>(
      storageLayer,
      serializer,
    );
    super(streamStore, transaction, snapshotter);
  }
}
