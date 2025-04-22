import { EventStreamStore, IEsEvent, INamed, ISerializer } from "@ddd-ts/core";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export class FirestoreEventStreamStore<
  Event extends IEsEvent,
> extends EventStreamStore<Event> {
  constructor(firestore: Firestore, serializer: ISerializer<Event>) {
    super(new FirestoreEventStreamStorageLayer(firestore), serializer);
  }
}
