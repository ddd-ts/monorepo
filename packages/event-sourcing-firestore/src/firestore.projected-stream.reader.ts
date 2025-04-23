import { IEsEvent, ISerializer, ProjectedStreamReader } from "@ddd-ts/core";
import { Firestore } from "firebase-admin/firestore";
import { FirestoreProjectedStreamStorageLayer } from "./firestore.projected-stream.storage-layer";

export class FirestoreProjectedStreamReader<
  Event extends IEsEvent,
> extends ProjectedStreamReader<Event> {
  constructor(firestore: Firestore, serializer: ISerializer<Event>) {
    super(new FirestoreProjectedStreamStorageLayer(firestore), serializer);
  }
}
