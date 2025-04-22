import { EventLakeStore, IEsEvent, INamed, ISerializer } from "@ddd-ts/core";
import { FirestoreEventLakeStorageLayer } from "./firestore.event-lake.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export class FirestoreEventLakeStore<
  Event extends IEsEvent,
> extends EventLakeStore<Event> {
  constructor(firestore: Firestore, serializer: ISerializer<Event>) {
    super(new FirestoreEventLakeStorageLayer(firestore), serializer);
  }
}
