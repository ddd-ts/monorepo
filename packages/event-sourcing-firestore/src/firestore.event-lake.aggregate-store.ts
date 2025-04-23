import {
  ISerializer,
  IEventSourced,
  IIdentifiable,
  EventOf,
  EventLakeStore,
  LakeId,
  IChange,
  IEventBus,
} from "@ddd-ts/core";
import {
  FirestoreStore,
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";

import { CollectionReference } from "firebase-admin/firestore";
import { FirestoreEventLakeStorageLayer } from "./firestore.event-lake.storage-layer";

export abstract class FirestoreEventLakeAggregateStore<
  A extends IEventSourced & IIdentifiable,
> extends FirestoreStore<A> {
  transaction: FirestoreTransactionPerformer;
  lakeStore: EventLakeStore<EventOf<A>>;
  constructor(
    collection: CollectionReference,
    serializer: ISerializer<EventOf<A>> & ISerializer<A>,
    eventBus?: IEventBus,
  ) {
    super(collection, serializer);
    const storageLayer = new FirestoreEventLakeStorageLayer(
      collection.firestore,
    );
    this.transaction = new FirestoreTransactionPerformer(collection.firestore);
    this.lakeStore = new EventLakeStore<EventOf<A>>(
      storageLayer,
      serializer,
      eventBus,
    );
  }

  abstract getLakeId(instance: A): LakeId;

  override async save(aggregate: A, trx?: FirestoreTransaction) {
    const changes = [...aggregate.changes] as IChange<EventOf<A>>[];

    await this.transaction.performWith(trx, async (trx) => {
      const lakeId = this.getLakeId(aggregate);

      await super.save(aggregate, trx);
      await this.lakeStore.append(lakeId, changes, trx);
      aggregate.clearChanges();
    });
  }
}
