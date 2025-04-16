import { Either, Multiple, Shape } from "@ddd-ts/shape";
import { IEsEvent, IFact, ISerializedFact } from "../interfaces/es-event";
import { INamed } from "../interfaces/named";
import { EventReference } from "./event-id";
import { SerializerRegistry } from "./serializer-registry";

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
  read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: EventReference,
    endAt?: EventReference,
  ): AsyncIterable<ISerializedFact>;
}

export class ProjectedStreamReader<Events extends (IEsEvent & INamed)[]> {
  constructor(
    private readonly reader: ProjectedStreamStorageLayer,
    private readonly registry: SerializerRegistry.For<Events>,
  ) {}

  async *read(
    projectedStream: ProjectedStream,
    shard: string,
    startAfter?: EventReference,
    endAt?: EventReference,
  ) {
    const stream = this.reader.read(projectedStream, shard, startAfter, endAt);

    for await (const fact of stream) {
      yield this.registry.deserialize<IFact<Events[number]>>(fact);
    }
  }
}
