import {
  EventLakeStore,
  IEsEvent,
  INamed,
  SerializerRegistry,
} from "@ddd-ts/core";
import { FirestoreEventLakeStorageLayer } from "./firestore.event-lake.storage-layer";
import { Firestore } from "firebase-admin/firestore";

export class FirestoreEventLakeStore<
  Events extends (IEsEvent & INamed)[],
> extends EventLakeStore<Events> {
  constructor(
    firestore: Firestore,
    serializer: SerializerRegistry.For<Events>,
  ) {
    super(new FirestoreEventLakeStorageLayer(firestore), serializer);
  }
}
