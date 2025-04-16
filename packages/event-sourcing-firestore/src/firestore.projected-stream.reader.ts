import {
  IEsEvent,
  INamed,
  ProjectedStreamReader,
  SerializerRegistry,
} from "@ddd-ts/core";
import { Firestore } from "firebase-admin/firestore";
import { FirestoreProjectedStreamStorageLayer } from "./firestore.projected-stream.storage-layer";

export class FirestoreProjectedStreamReader<
  Events extends (IEsEvent & INamed)[],
> extends ProjectedStreamReader<Events> {
  constructor(
    firestore: Firestore,
    serializer: SerializerRegistry.For<Events>,
  ) {
    super(new FirestoreProjectedStreamStorageLayer(firestore), serializer);
  }
}
