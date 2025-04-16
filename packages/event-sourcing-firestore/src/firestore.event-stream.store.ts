import {
  EventStreamStore,
  IEsEvent,
  INamed,
  SerializerRegistry,
} from "@ddd-ts/core";
import { FirestoreEventStreamStorageLayer } from "./firestore.event-stream.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export class FirestoreEventStreamStore<
  Events extends (IEsEvent & INamed)[],
> extends EventStreamStore<Events> {
  constructor(
    firestore: Firestore,
    serializer: SerializerRegistry.For<Events>,
  ) {
    super(new FirestoreEventStreamStorageLayer(firestore), serializer);
  }
}
