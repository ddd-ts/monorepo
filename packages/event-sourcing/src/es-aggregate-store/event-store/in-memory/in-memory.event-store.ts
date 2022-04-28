import { Account, AccountId, Deposited } from "../../../test";
import { Constructor, EventStore } from "../event-store";
import { ProjectedStream } from "./projected-stream";
import { Stream } from "./stream";


/**
 * EventStore -> Stream[]
 * EventStore -> ProjectedStreams[]
 * 
 * eventStore.follow(PS) -> ProjectedStream.follow()
 * eventStore.follow(PS) -> same projectestream.follow()
 * 
 */

export class InMemoryEventStore extends EventStore {
  private streams = new Map<string, Stream>();
  private projectedStreams = new Map<string, ProjectedStream>();

  private newStreamSubscribers = new Set<(stream: Stream) => void>();

  clear() {
    this.streams.clear();
    this.projectedStreams.clear();
  }

  async appendToAggregateStream(
    AGGREGATE: Constructor<Account>,
    accountId: AccountId,
    changes: Deposited[],
    expectedRevision?: bigint
  ) {
    const streamName = `${AGGREGATE.name}-${accountId.serialize()}`;

    if (!this.streams.has(streamName)) {
      const stream = new Stream();
      this.streams.set(streamName, stream);
      this.newStreamSubscribers.forEach((subscriber) => subscriber(stream));
    }

    const stream = this.streams.get(streamName)!;

    if (expectedRevision !== undefined) {
      const currentRevision = stream.facts.length - 1;
      if (currentRevision !== Number(expectedRevision)) {
        throw new Error(
          `Expected revision ${expectedRevision} but got ${currentRevision}`
        );
      }
    }

    for (const change of changes) {
      stream.append(change);
    }
  }

  async *readAggregateStream(
    AGGREGATE: Constructor<Account>,
    accountId: AccountId,
    from = 0n
  ) {
    const streamName = `${AGGREGATE.name}-${accountId.serialize()}`;

    const stream = this.streams.get(streamName);
    if (!stream) {
      return;
    }

    for await (const { occuredAt, ...fact } of stream.readRaw(from)) {
      yield fact;
    }
  }

  private getProjectedStream(AGGREGATE: Constructor<Account>): ProjectedStream {
    const streamName = `${AGGREGATE.name}`;

    if (this.projectedStreams.has(streamName)) {
      return this.projectedStreams.get(streamName)!;
    }

    const streams = [...this.streams.keys()];
    const correspondingStreams = streams
      .filter((name) => name.includes(AGGREGATE.name))
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
      });
      // here we need to unsubscribe
    }

    this.newStreamSubscribers.add((stream) => {
      // handle non corresponding streams
      const unsubscribe = stream.subscribe((fact) => {
        projectedStream.append(fact);
      });
      // here we need to unsubscribe
    });

    this.projectedStreams.set(streamName, projectedStream);
    return projectedStream;
  }

  async *readProjectedStream(AGGREGATE: Constructor<Account>, from = 0n) {
    const projectedStream = this.getProjectedStream(AGGREGATE);

    yield* projectedStream.read(from);
  }

  async followProjectedStream(AGGREGATE: Constructor<Account>, from = 0n) {
    const projectedStream = this.getProjectedStream(AGGREGATE);

    return projectedStream.follow(from);
  }

  async competeForProjectedStream(
    AGGREGATE: Constructor<Account>,
    competition: string
  ) {
    const projectedStream = this.getProjectedStream(AGGREGATE);

    return projectedStream.compete(competition);
  }
}
