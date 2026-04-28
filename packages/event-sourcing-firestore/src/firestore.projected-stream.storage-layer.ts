import {
  type ISerializedFact,
  type ISerializedSavedChange,
  LakeSource,
  ProjectedStream,
  type ProjectedStreamStorageLayer,
  StreamSource,
} from "@ddd-ts/core";
import { DefaultConverter } from "@ddd-ts/store-firestore";
import {
  FieldPath,
  Filter,
  Firestore,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { MicrosecondTimestamp } from "@ddd-ts/shape";
import { Cursor } from "@ddd-ts/core/dist/components/cursor";

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
    startAfter?: Cursor,
    endAt?: Cursor,
  ) {
    let query = this.firestore
      .collectionGroup("events")
      .orderBy("occurredAt")
      .orderBy("revision")
      .orderBy(FieldPath.documentId());

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

    if (startAfter && !startAfter.isMin()) {
      const ts = this.microsecondToTimestamp(startAfter.occurredAt);
      query = query.startAfter(
        ts,
        startAfter.revision,
        this.firestore.doc(startAfter.ref),
      );
    }

    if (endAt && !endAt.isMax()) {
      const ts = this.microsecondToTimestamp(endAt.occurredAt);
      query = query.endAt(
        ts,
        endAt.revision,
        this.firestore.doc(endAt.ref),
      );
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
  public microsecondToTimestamp(microseconds: MicrosecondTimestamp) {
    const seconds = BigInt(microseconds.micros) / 1_000_000n;
    const nanoseconds = (BigInt(microseconds.micros) % 1_000_000n) * 1000n; // Convert to nanoseconds
    return new Timestamp(Number(seconds), Number(nanoseconds));
  }

  async get(cursor: Cursor) {
    const doc = await this.firestore.doc(cursor.ref).get();
    if (!doc.exists) {
      return undefined;
    }
    const data = this.converter.fromFirestoreSnapshot(doc) as any;
    return {
      id: data.eventId,
      ref: doc.ref.path,
      revision: data.revision,
      name: data.name,
      $name: data.name,
      payload: data.payload,
      occurredAt: data.occurredAt,
      version: data.version ?? 1,
    } as ISerializedFact;
  }

  async getCursor(
    savedChange: ISerializedSavedChange,
  ): Promise<Cursor | undefined> {
    const doc = await this.firestore.doc(savedChange.ref).get();
    if (!doc.exists) {
      return undefined;
    }
    const data = this.converter.fromFirestoreSnapshot(doc) as any;
    return Cursor.deserialize({
      eventId: data.eventId,
      ref: doc.ref.path,
      occurredAt: data.occurredAt,
      revision: data.revision,
    });
  }

  async slice(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
    limit?: number,
  ) {
    let query = this.firestore
      .collectionGroup("events")
      .orderBy("occurredAt")
      .orderBy("revision")
      .orderBy(FieldPath.documentId());

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

    if (startAfter && !startAfter.isMin()) {
      const ts = this.microsecondToTimestamp(startAfter.occurredAt);
      query = query.startAfter(
        ts,
        startAfter.revision,
        this.firestore.doc(startAfter.ref),
      );
    }

    if (endAt && !endAt.isMax()) {
      const ts = this.microsecondToTimestamp(endAt.occurredAt);
      query = query.endAt(
        ts,
        endAt.revision,
        this.firestore.doc(endAt.ref),
      );
    }

    if (limit) {
      query = query.limit(limit);
    }

    const all = await query.get();

    return all.docs.map((doc) => {
      const data = this.converter.fromFirestore(doc);
      return {
        id: data.eventId,
        ref: doc.ref.path,
        revision: data.revision,
        name: data.name,
        $name: data.name,
        payload: data.payload,
        occurredAt: data.occurredAt,
        version: data.version ?? 1,
      } as ISerializedFact;
    });
  }

  async firstAtOrAfter(
    projectedStream: ProjectedStream,
    shard: string,
    from: MicrosecondTimestamp,
  ): Promise<ISerializedFact | undefined> {
    const ts = this.microsecondToTimestamp(from);
    let query = this.firestore
      .collectionGroup("events")
      .orderBy("occurredAt")
      .orderBy("revision")
      .orderBy(FieldPath.documentId());

    const filters = projectedStream.sources.map((source) => {
      if (source instanceof LakeSource) {
        return new FirestoreLakeSourceFilter().filter(shard, source);
      }
      if (source instanceof StreamSource) {
        return new FirestoreStreamSourceFilter().filter(shard, source);
      }
      throw new Error("Unknown source type");
    });

    query = query.where(Filter.or(...filters)).startAt(ts).limit(1);

    const snap = await query.get();
    const doc = snap.docs[0];
    if (!doc) return undefined;
    const data = this.converter.fromFirestore(doc);
    return {
      id: data.eventId,
      ref: doc.ref.path,
      revision: data.revision,
      name: data.name,
      $name: data.name,
      payload: data.payload,
      occurredAt: data.occurredAt,
      version: data.version ?? 1,
    } as ISerializedFact;
  }

  async latest(
    projectedStream: ProjectedStream,
    shard: string,
  ): Promise<ISerializedFact | undefined> {
    let query = this.firestore
      .collectionGroup("events")
      .orderBy("occurredAt", "desc")
      .orderBy("revision", "desc")
      .orderBy(FieldPath.documentId(), "desc")
      .limit(1);

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

    const snap = await query.get();
    const doc = snap.docs[0];
    if (!doc) return undefined;
    const data = this.converter.fromFirestore(doc);
    return {
      id: data.eventId,
      ref: doc.ref.path,
      revision: data.revision,
      name: data.name,
      $name: data.name,
      payload: data.payload,
      occurredAt: data.occurredAt,
      version: data.version ?? 1,
    } as ISerializedFact;
  }
}
