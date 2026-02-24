import { Either, Multiple, Shape } from "@ddd-ts/shape";
import type {
  IEsEvent,
  IFact,
  ISavedChange,
  ISerializedFact,
  ISerializedSavedChange,
} from "../interfaces/es-event";
import type { ISerializer } from "../interfaces/serializer";
import { Cursor } from "./cursor";

export class StreamSource extends Shape({
  aggregateType: String,
  shardKey: String,
  events: [String],
}) {}

export class LakeSource extends Shape({
  shardType: String,
  shardKey: String,
  events: [String],
}) {}

export class ProjectedStream extends Shape({
  sources: Multiple(
    Either({
      stream: StreamSource,
      lake: LakeSource,
    }),
  ),
}) {}

export interface ProjectedStreamStorageLayer {
  getCursor(savedChange: ISerializedSavedChange): Promise<Cursor | undefined>;

  get(cursor: Cursor): Promise<ISerializedFact | undefined>;

  read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
  ): AsyncIterable<ISerializedFact>;

  slice(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
    count?: number,
  ): Promise<ISerializedFact[]>;
}

export class ProjectedStreamReader<Event extends IEsEvent> {
  constructor(
    private readonly reader: ProjectedStreamStorageLayer,
    private readonly registry: ISerializer<Event>,
  ) {}

  async getCursor(savedChange: ISavedChange<Event>) {
    const serialized = await this.registry.serialize(savedChange);
    return this.reader.getCursor(serialized as ISerializedSavedChange);
  }

  async get(cursor: Cursor) {
    const serializedFact = await this.reader.get(cursor);
    if (!serializedFact) {
      return undefined;
    }
    return this.registry.deserialize(serializedFact) as IFact<Event>;
  }

  async *read(
    source: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
  ): AsyncGenerator<IFact<Event>> {
    const stream = this.reader.read(source, shard, startAfter, endAt);

    for await (const fact of stream) {
      yield this.registry.deserialize(fact) as IFact<Event>;
    }
  }

  async slice(
    source: ProjectedStream,
    shard: string,
    startAfter?: Cursor,
    endAt?: Cursor,
    limit?: number,
  ) {
    const slice = await this.reader.slice(
      source,
      shard,
      startAfter,
      endAt,
      limit,
    );

    return (await Promise.all(
      slice.map((fact) => this.registry.deserialize(fact)),
    )) as IFact<Event>[];
  }
}
