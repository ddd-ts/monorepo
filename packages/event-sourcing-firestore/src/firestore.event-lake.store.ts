import { EventLakeStore, IEsEvent, IEventBus, ISerializer } from "@ddd-ts/core";
import { FirestoreEventLakeStorageLayer } from "./firestore.event-lake.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export class FirestoreEventLakeStore<
  Event extends IEsEvent,
> extends EventLakeStore<Event> {
  constructor(
    firestore: Firestore,
    serializer: ISerializer<Event>,
    eventBus?: IEventBus,
  ) {
    super(new FirestoreEventLakeStorageLayer(firestore), serializer, eventBus);
  }
}
