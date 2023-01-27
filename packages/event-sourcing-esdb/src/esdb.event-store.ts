import { EventStoreDBClient, jsonEvent } from "@eventstore/db-client";
import {
  EsAggregate,
  Event,
  Serializable,
  closeable,
  map,
  Competitor,
  Constructor,
  EsChange,
  EsFact,
  EventStore,
  Follower,
  ProjectedStreamConfiguration,
} from "@ddd-ts/event-sourcing";
process.env.DEBUG = "esdb:*";
export class ESDBEventStore extends EventStore {
  client: EventStoreDBClient;
  namespace: string;
  constructor() {
    super();
    this.namespace = Math.random().toString().substring(2, 8);
    this.client = new EventStoreDBClient(
      { endpoint: { address: "localhost", port: 2113 } },
      { insecure: true }
    );
  }

  private readonly subscriptions = new Set<() => Promise<any>>();

  async close() {
    await Promise.all([...this.subscriptions.values()].map((s) => s()));
    this.client.dispose();
  }

  async clear() {
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
    expectedRevision: bigint
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

  private getProjectedStreamName(AGGREGATE: ProjectedStreamConfiguration[0]) {
    return "$ce-" + this.namespace + "." + AGGREGATE.name;
  }

  private async ensureProjectedStream(config: ProjectedStreamConfiguration) {
    if (config.length === 1) {
      return this.getProjectedStreamName(config[0]);
    }

    const projectionNameSuffix = config
      .map((a) => a.name)
      .sort()
      .join("-");

    const stableProjectionName =
      this.namespace + "." + "pj-" + projectionNameSuffix;

    const streams = config.map((a) => this.getProjectedStreamName(a));

    const query = `
      fromStreams(${streams
        .map((s) => `'${s}'`)
        .join(
          ", "
        )}).when({ $any: function(state, event) { linkTo('${stableProjectionName}', event) }})
    `;

    await this.client.createProjection(stableProjectionName, query, {
      emitEnabled: true,
    });

    let status;

    let attempts = 0;
    do {
      status = await this.client.getProjectionStatus(stableProjectionName);
      if (status.progress < 100) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      attempts++;
      if (attempts > 20) {
        throw new Error("projection not stable");
      }
    } while (status.progress < 100);

    return stableProjectionName;
  }

  async *readProjectedStream(
    config: ProjectedStreamConfiguration,
    from?: bigint
  ): AsyncIterable<EsFact> {
    const stream = await this.ensureProjectedStream(config);

    for await (const event of this.client.readStream(stream, {
      fromRevision: from,
      resolveLinkTos: true,
      direction: "forwards",
    })) {
      if (!event.event) {
        throw new Error("no event");
      }
      if (!event.link) {
        throw new Error("no link");
      }

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
    const streamName = await this.ensureProjectedStream(AGGREGATE);

    const position = from - 1n;
    const fromRevision = position < 0n ? "start" : position;

    const stream = this.client.subscribeToStream(streamName, {
      fromRevision,
      resolveLinkTos: true,
    });

    const hook = async () => void stream.destroy();

    this.subscriptions.add(hook);

    const mapped = map(stream, (e) => {
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

    return closeable(mapped, async () => {
      await stream.unsubscribe();
      this.subscriptions.delete(hook);
    });
  }

  competeForProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    competitionName: string
  ): Promise<Competitor> {
    throw new Error("Method not implemented.");
  }

  // async competeForProjectedStream(
  //   AGGREGATE: ProjectedStreamConfiguration,
  //   competitionName: string
  // ): Promise<Competitor> {
  //   const streamName = this.getProjectedStreamName(AGGREGATE);

  //   try {
  //     await this.client.createPersistentSubscriptionToStream(
  //       streamName,
  //       competitionName,
  //       persistentSubscriptionToStreamSettingsFromDefaults({
  //         resolveLinkTos: true,
  //       })
  //     );
  //   } catch (error: any) {
  //     if (
  //       isCommandError(error) &&
  //       error.type === ErrorType.PERSISTENT_SUBSCRIPTION_EXISTS
  //     ) {
  //       // do nothing and use the existing one
  //     } else {
  //       throw error;
  //     }
  //   }

  //   const sub = this.client.subscribeToPersistentSubscriptionToStream(
  //     streamName,
  //     competitionName
  //   );

  //   return closeable(
  //     map(sub, (event) => {
  //       if (!event.event) {
  //         throw new Error(follow
  //           "[ESDB] listening projected stream : iterated over unreadable event"
  //         );
  //       }
  //       const revision =
  //         event.link?.revision !== undefined ? event.link?.revision : undefined;

  //       if (revision === undefined) {
  //         throw new Error(
  //           "[ESDB] listening projected stream : iterated over unreadable event"
  //         );
  //       }
  //       return {
  //         fact: {
  //           id: event.event.id,
  //           type: event.event.type,
  //           payload: event.event.data as Serializable,
  //           revision,
  //         },
  //         succeed: async () => {
  //           await sub.ack(event);
  //         },
  //         retry: async () => {
  //           await sub.nack("retry", "unknown", event);
  //         },
  //         skip: async () => {
  //           await sub.nack("skip", "unknown", event);
  //         },
  //       };
  //     }),
  //     async () => {
  //       await sub.unsubscribe();
  //     }
  //   );
  // }
}
