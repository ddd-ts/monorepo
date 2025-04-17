import {
  EventReference,
  LakeSource,
  ProjectedStream,
  ProjectedStreamStorageLayer,
  StreamSource,
} from "@ddd-ts/core";
import { InMemoryDatabase } from "@ddd-ts/store-inmemory";

export class InMemoryStreamSourceFilter {
  constructor(private readonly database: InMemoryDatabase) {}

  *all(source: StreamSource, shard: string) {
    const cols = [...this.database.storage.collections.keys()];
    const streams = cols.filter((it) => it.startsWith(source.aggregateType));
    for (const stream of streams) {
      console.log(`Loading all events from ${stream}`);
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
    yield* this.database
      .loadAll(`${source.shardType}-${shard}`)
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

  async *read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: EventReference,
    endAt?: EventReference,
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
      )
      .map((event) => event.data);

    let started = !startAfter;
    for (const event of all) {
      if (startAfter && event.ref === startAfter.serialize()) {
        started = true;
        continue;
      }
      if (endAt && event.ref === endAt.serialize()) {
        yield event;
        break;
      }
      if (started) {
        yield event;
      }
    }
  }
}
