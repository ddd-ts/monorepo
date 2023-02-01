import {
  EsAggregate,
  EsChange,
  EventStore,
  ProjectedStreamConfiguration,
} from "@ddd-ts/event-sourcing";
import { Constructor } from "@ddd-ts/types";
import { ProjectedStream } from "./projected-stream";
import { Stream } from "./stream";

export class InMemoryEventStore extends EventStore {
  private streams = new Map<string, Stream>();
  private projectedStreams = new Map<string, ProjectedStream>();

  private newStreamSubscribers = new Set<(stream: Stream) => void>();

  async close() {
    this.clear();
  }

  async clear() {
    this.streams.clear();
    for (const [key, value] of this.projectedStreams) {
      value.onCloseCallbacks.forEach((callback) => callback());
    }
    this.projectedStreams.clear();
  }

  async appendToAggregateStream<A extends EsAggregate>(
    AGGREGATE: Constructor<A>,
    accountId: A extends EsAggregate<infer Id> ? Id : never,
    changes: EsChange[],
    expectedRevision: bigint
  ) {
    const streamName = `${AGGREGATE.name}-${accountId.toString()}`;

    if (!this.streams.has(streamName)) {
      const stream = new Stream();
      this.streams.set(streamName, stream);
      this.newStreamSubscribers.forEach((subscriber) => subscriber(stream));
    }

    const stream = this.streams.get(streamName)!;

    const currentRevision = stream.facts.length - 1;
    if (currentRevision !== Number(expectedRevision)) {
      throw new Error(
        `Expected revision ${expectedRevision} but got ${currentRevision}`
      );
    }

    for (const change of changes) {
      stream.append(change);
    }
  }

  async *readAggregateStream<A extends EsAggregate>(
    AGGREGATE: Constructor<A>,
    accountId: A extends EsAggregate<infer Id> ? Id : never,
    from = 0n
  ) {
    const streamName = `${AGGREGATE.name}-${accountId.toString()}`;

    const stream = this.streams.get(streamName);
    if (!stream) {
      return;
    }

    for await (const { occuredAt, ...fact } of stream.readRaw(from)) {
      yield fact;
    }
  }

  private getProjectedStream(
    config: ProjectedStreamConfiguration
  ): ProjectedStream {
    const streamName = config
      .map((a) => a.name)
      .sort()
      .join("+");

    if (this.projectedStreams.has(streamName)) {
      return this.projectedStreams.get(streamName)!;
    }

    const streams = [...this.streams.keys()];
    const correspondingStreams = streams
      .filter((name) => config.some((a) => a.name === name.split("-")[0]))
      .map((name) => this.streams.get(name)!);

    const orderedFacts = correspondingStreams
      .map((stream) => stream.facts)
      .flat()
      .sort((a, b) => a.occuredAt.getTime() - b.occuredAt.getTime());

    const projectedStream = new ProjectedStream();

    for (const fact of orderedFacts) {
      projectedStream.append(fact);
    }

    for (const stream of correspondingStreams) {
      const unsubscribe = stream.subscribe((fact) => {
        projectedStream.append(fact);
        projectedStream.onClose(unsubscribe);
      });
      // here we need to unsubscribe
    }

    this.newStreamSubscribers.add((stream) => {
      // handle non corresponding streams
      const unsubscribe = stream.subscribe((fact) => {
        projectedStream.append(fact);
      });
      projectedStream.onClose(unsubscribe);
      // here we need to unsubscribe
    });

    this.projectedStreams.set(streamName, projectedStream);
    return projectedStream;
  }

  async *readProjectedStream(config: ProjectedStreamConfiguration, from = 0n) {
    const projectedStream = this.getProjectedStream(config);

    yield* projectedStream.read(from);
  }

  async followProjectedStream(config: ProjectedStreamConfiguration, from = 0n) {
    const projectedStream = this.getProjectedStream(config);

    return projectedStream.follow(from);
  }

  async competeForProjectedStream(
    config: ProjectedStreamConfiguration,
    competition: string
  ) {
    const projectedStream = this.getProjectedStream(config);

    return projectedStream.compete(competition);
  }
}
