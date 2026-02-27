import {
  EventId,
  type ISerializedFact,
  LakeId,
  LakeSource,
  ProjectedStream,
  type ProjectedStreamStorageLayer,
  StreamSource,
  Cursor,
  type ISerializedSavedChange,
} from "@ddd-ts/core";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";
import { MicrosecondTimestamp } from "@ddd-ts/shape";

export class InMemoryStreamSourceFilter {
  constructor(private readonly database: InMemoryDatabase) {}

  *all(source: StreamSource, shard: string) {
    const cols = [...this.database.storage.collections.keys()];
    const streams = cols.filter((it) => it.startsWith(source.aggregateType));
    for (const stream of streams) {
      yield* this.database
        .loadAll(stream)
        .filter((event) => {
          if (!source.events.includes(event.data.data.name)) return false;
          const payload = event.data.data.payload;
          if (!payload) return false;
          return payload[source.shardKey] === shard;
        })
        .map((event) => event.data);
    }
  }
}

export class InMemoryLakeSourceFilter {
  constructor(private readonly database: InMemoryDatabase) {}

  *all(source: LakeSource, shard: string) {
    const lakeId = LakeId.from(source.shardType, shard);
    yield* this.database
      .loadAll(lakeId.serialize())
      .filter((event) => {
        if (!source.events.includes(event.data.data.name)) return false;
        const payload = event.data.data.payload;
        if (!payload) return false;
        return payload[source.shardKey] === shard;
      })
      .map((event) => event.data);
  }
}

export class InMemoryProjectedStreamStorageLayer
  implements ProjectedStreamStorageLayer
{
  constructor(private readonly database: InMemoryDatabase) {}

  async getCursor(
    savedChange: ISerializedSavedChange,
  ): Promise<Cursor | undefined> {
    const [collection, id] = savedChange.ref.split("/");
    if (!collection || !id) return undefined;

    const raw = this.database.storage.getCollection(collection).getRaw(id);

    if (!raw) return undefined;
    return new Cursor({
      ref: savedChange.ref,
      eventId: new EventId(savedChange.id),
      occurredAt: MicrosecondTimestamp.fromMicroseconds(raw.savedAt),
      revision: savedChange.revision,
    });
  }

  async get(cursor: Cursor): Promise<ISerializedFact | undefined> {
    const [collection, id] = cursor.ref.split("/");
    if (!collection || !id) return undefined;

    const raw = this.database.storage.getCollection(collection).getRaw(id);

    if (!raw) return undefined;
    return { ...raw.data, occurredAt: raw.savedAt };
  }

  async *read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
  ) {
    const sources = projectedStream.sources.map((source) => {
      if (source instanceof StreamSource) {
        return new InMemoryStreamSourceFilter(this.database).all(source, shard);
      }
      return new InMemoryLakeSourceFilter(this.database).all(source, shard);
    });

    const all = sources
      .flatMap((source) => [...source])
      .sort((a, b) =>
        a.savedAt === b.savedAt
          ? a.data.revision - b.data.revision
          : a.savedAt > b.savedAt
            ? 1
            : -1,
      );

    let started = !startAfter?.ref;
    for (const fact of all) {
      if (startAfter && fact.data.ref === startAfter.ref) {
        started = true;
        continue;
      }
      if (endAt?.ref && fact.data.ref === endAt.ref) {
        yield { ...fact.data, occurredAt: fact.savedAt };
        break;
      }
      if (started) {
        yield { ...fact.data, occurredAt: fact.savedAt };
      }
    }
  }

  async slice(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
    count?: number,
  ): Promise<ISerializedFact[]> {
    const stream = this.read(projectedStream, shard, startAfter, endAt);

    const result: ISerializedFact[] = [];

    let limit = count ?? Number.POSITIVE_INFINITY;
    for await (const fact of stream) {
      if (!limit--) break;
      result.push(fact);
    }

    return result;
  }
}
