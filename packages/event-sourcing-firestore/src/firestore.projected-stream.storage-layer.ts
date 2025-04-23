import {
  EventReference,
  LakeSource,
  ProjectedStream,
  ProjectedStreamStorageLayer,
  StreamSource,
} from "@ddd-ts/core";
import { DefaultConverter } from "@ddd-ts/store-firestore";
import {
  Filter,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

export class FirestoreLakeSourceFilter {
  filter(shard: string, lakeSource: LakeSource) {
    return Filter.and(
      Filter.where(`payload.${lakeSource.shardKey}`, "==", shard),
      Filter.where("name", "in", lakeSource.events),
    );
  }
}

export class FirestoreStreamSourceFilter {
  filter(shard: string, streamSource: StreamSource) {
    return Filter.and(
      Filter.where("aggregateType", "==", streamSource.aggregateType),
      Filter.where(`payload.${streamSource.shardKey}`, "==", shard),
      Filter.where("name", "in", streamSource.events),
    );
  }
}

export class FirestoreProjectedStreamStorageLayer
  implements ProjectedStreamStorageLayer
{
  constructor(
    private readonly firestore: Firestore,
    public readonly converter = new DefaultConverter(),
  ) {}

  async *read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: EventReference,
    endAt?: EventReference,
  ) {
    let query = this.firestore
      .collectionGroup("events")
      .orderBy("occurredAt")
      .orderBy("revision");

    const [start, end] = await Promise.all([
      startAfter ? this.firestore.doc(startAfter.serialize()).get() : null,
      endAt ? this.firestore.doc(endAt.serialize()).get() : null,
    ]);

    if (startAfter && !start?.exists) {
      throw new Error(`StartAfter event not found: ${startAfter}`);
    }

    if (endAt && !end?.exists) {
      throw new Error(`EndAt event not found: ${endAt}`);
    }

    const filters = projectedStream.sources.map((source) => {
      if (source instanceof LakeSource) {
        return new FirestoreLakeSourceFilter().filter(shard, source);
      }
      if (source instanceof StreamSource) {
        return new FirestoreStreamSourceFilter().filter(shard, source);
      }
      throw new Error("Unknown source type");
    });

    query = query.where(Filter.or(...filters));

    if (start) {
      query = query.startAfter(start);
    }

    if (end) {
      query = query.endAt(end);
    }

    for await (const doc of query.stream() as AsyncIterable<QueryDocumentSnapshot>) {
      const data = this.converter.fromFirestore(doc);
      yield {
        id: data.eventId,
        ref: doc.ref.path,
        revision: data.revision,
        name: data.name,
        $name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      };
    }
  }
}
