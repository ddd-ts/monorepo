import {
  EventStreamStore,
  type IEsEvent,
  type IEventBus,
  type ISerializer,
} from "@ddd-ts/core";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export class FirestoreEventStreamStore<
  Event extends IEsEvent,
> extends EventStreamStore<Event> {
  constructor(
    firestore: Firestore,
    serializer: ISerializer<Event>,
    eventBus?: IEventBus,
  ) {
    super(
      new FirestoreEventStreamStorageLayer(firestore),
      serializer,
      eventBus,
    );
  }
}
