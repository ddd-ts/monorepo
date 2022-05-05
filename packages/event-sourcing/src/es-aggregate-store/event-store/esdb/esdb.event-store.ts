import {
  ErrorType,
  EventStoreDBClient,
  isCommandError,
  jsonEvent,
  persistentSubscriptionToStreamSettingsFromDefaults,
} from "@eventstore/db-client";
import { EsAggregate } from "../../../es-aggregate/es-aggregate";
import { Event, Serializable } from "../../../event/event";
import { closeable, map } from "../../tools/iterator";
import {
  Competitor,
  Constructor,
  EsChange,
  EsFact,
  EventStore,
  Follower,
  ProjectedStreamConfiguration,
} from "../event-store";

export class ESDBEventStore extends EventStore {
  client: EventStoreDBClient;

  namespace = Math.random().toString().substring(2, 8);

  constructor() {
    super();
    this.client = new EventStoreDBClient(
      { endpoint: { address: "localhost", port: 2113 } },
      { insecure: true }
    );
  }

  async close() {
    await this.client.dispose();
  }

  clear() {
    this.namespace = Math.random().toString().substring(2, 8);
  }

  private getAggregateStreamName(
    AGGREGATE: Constructor<EsAggregate>,
    id: string
  ) {
    return this.namespace + "." + AGGREGATE.name + "-" + id;
  }

  async appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: { toString(): string },
    changes: EsChange[],
    expectedRevision?: bigint
  ): Promise<void> {
    const r = expectedRevision === -1n ? "no_stream" : expectedRevision;

    const events = changes.map((c) =>
      jsonEvent({ id: c.id, type: c.type, data: c.payload })
    );

    const streamName = this.getAggregateStreamName(AGGREGATE, id.toString());

    await this.client.appendToStream(streamName, events, {
      expectedRevision: r,
    });
  }

  async *readAggregateStream(
    AGGREGATE: Constructor<EsAggregate<{ toString(): string }, Event>, any[]>,
    id: { toString(): string },
    from?: bigint
  ): AsyncIterable<EsFact> {
    const streamName = this.getAggregateStreamName(AGGREGATE, id.toString());

    for await (const event of this.client.readStream(streamName, {
      fromRevision: from,
    })) {
      if (!event.event) {
        throw new Error("no event");
      }

      yield {
        id: event.event.id,
        payload: event.event.data as Serializable,
        type: event.event.type,
        revision: event.event.revision,
      };
    }
  }

  private getProjectedStreamName(AGGREGATE: ProjectedStreamConfiguration) {
    return "$ce-" + this.namespace + "." + AGGREGATE.name;
  }

  async *readProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    from?: bigint
  ): AsyncIterable<EsFact> {
    const streamName = this.getProjectedStreamName(AGGREGATE);

    // const fromRevision = from === 0n ? "start" : from;

    for await (const event of this.client.readStream(streamName, {
      fromRevision: from,
      resolveLinkTos: true,
    })) {
      if (!event.event) {
        throw new Error("no event");
      }
      if (!event.link) {
        throw new Error("no link");
      }
      console.log(event);

      yield {
        id: event.event.id,
        payload: event.event.data as Serializable,
        type: event.event.type,
        revision: event.link.revision,
      };
    }
  }

  async followProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    from: bigint = 0n
  ): Promise<Follower> {
    const streamName = this.getProjectedStreamName(AGGREGATE);

    const position = from - 1n;
    const fromRevision = position < 0n ? "start" : position;

    const stream = this.client.subscribeToStream(streamName, {
      fromRevision: fromRevision,
      resolveLinkTos: true,
    });

    const mapped = map(stream, (e) => {
      console.log("mapping", e);
      if (!e.event) {
        throw new Error("no event");
      }
      if (!e.link) {
        throw new Error("no link");
      }
      return {
        id: e.event.id,
        payload: e.event.data as Serializable,
        type: e.event.type,
        revision: e.link.revision,
      };
    });

    return closeable(mapped, () => stream.unsubscribe());
  }

  async competeForProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    competitionName: string
  ): Promise<Competitor> {
    const streamName = this.getProjectedStreamName(AGGREGATE);

    try {
      await this.client.createPersistentSubscriptionToStream(
        streamName,
        competitionName,
        persistentSubscriptionToStreamSettingsFromDefaults({
          resolveLinkTos: true,
        })
      );
    } catch (error: any) {
      if (
        isCommandError(error) &&
        error.type === ErrorType.PERSISTENT_SUBSCRIPTION_EXISTS
      ) {
        // do nothing and use the existing one
      } else {
        throw error;
      }
    }

    const sub = this.client.subscribeToPersistentSubscriptionToStream(
      streamName,
      competitionName
    );

    return closeable(
      map(sub, (event) => {
        if (!event.event) {
          throw new Error(
            "[ESDB] listening projected stream : iterated over unreadable event"
          );
        }
        const revision =
          event.link?.revision !== undefined ? event.link?.revision : undefined;

        if (revision === undefined) {
          throw new Error(
            "[ESDB] listening projected stream : iterated over unreadable event"
          );
        }
        return {
          fact: {
            id: event.event.id,
            type: event.event.type,
            payload: event.event.data as Serializable,
            revision,
          },
          succeed: async () => {
            await sub.ack(event);
          },
          retry: async () => {
            await sub.nack("retry", "unknown", event);
          },
          skip: async () => {
            await sub.nack("skip", "unknown", event);
          },
        };
      }),
      async () => {
        await sub.unsubscribe();
      }
    );
  }
}
