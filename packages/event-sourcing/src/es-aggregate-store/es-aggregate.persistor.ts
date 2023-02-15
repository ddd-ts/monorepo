import { Constructor } from "@ddd-ts/types";
import { EsAggregate } from "../es-aggregate/es-aggregate";
import { EventSerializer } from "../event/event-serializer";
import { Event, Snapshotter } from "../index";
import { EventStore } from "./event-store";

export type EsAggregateType<A extends EsAggregate<any, Event[]>> =
  Constructor<A> & {
    instanciate: (id: A["id"]) => A;
  };

export interface EsAggregatePersistor<A extends EsAggregate<any, any>> {
  persist(aggregate: A): Promise<void>;
  load(aggregateId: A["id"]): Promise<A>;
}

export type AllEventSerializers<A extends EsAggregate<any, any>> =
  A extends EsAggregate<any, infer E>
    ? E extends Event[]
      ? Readonly<{ [P in keyof E]: EventSerializer<E[P]> }>
      : never
    : never;

export function EsAggregatePersistor<
  AGG extends EsAggregateType<EsAggregate<any, any>>
>(AGGREGATE: AGG) {
  return class {
    constructor(
      public eventStore: EventStore,
      public serializers: AllEventSerializers<InstanceType<AGG>>
    ) {}

    public getSerializer(type: string) {
      const serializer = this.serializers.find((s) => s.type === type);
      if (!serializer) {
        throw new Error(`no serializer for event type ${type}`);
      }
      return serializer;
    }

    async persist(aggregate: InstanceType<AGG>) {
      const serialized = await Promise.all(
        aggregate.changes.map((event) => {
          const serializer = this.getSerializer(event.type);
          return serializer.serialize(event);
        })
      );

      await this.eventStore.appendToAggregateStream(
        AGGREGATE,
        aggregate.id,
        serialized,
        aggregate.acknowledgedRevision
      );
      aggregate.acknowledgeChanges();
    }

    async load(
      aggregateId: InstanceType<AGG>["id"]
    ): Promise<InstanceType<AGG>> {
      const instance = AGGREGATE.instanciate(aggregateId);
      const stream = this.eventStore.readAggregateStream(
        AGGREGATE,
        aggregateId
      );

      for await (const fact of stream) {
        const serializer = this.getSerializer(fact.type);
        const event = await serializer.deserialize(fact);
        instance.load(event);
      }

      return instance as any;
    }
  };
}

export function EsAggregatePersistorWithSnapshots<
  A extends EsAggregateType<any>
>(AGGREGATE: A) {
  return class extends EsAggregatePersistor(AGGREGATE) {
    constructor(
      eventStore: EventStore,
      serializers: AllEventSerializers<InstanceType<A>>,
      public snapshotter: Snapshotter<InstanceType<A>>
    ) {
      super(eventStore, serializers);
    }

    async persist(aggregate: InstanceType<A>) {
      await super.persist(aggregate);
      await this.snapshotter.save(aggregate);
    }

    async load(aggregateId: InstanceType<A>["id"]): Promise<InstanceType<A>> {
      const instance = await this.snapshotter.load(aggregateId);

      if (instance) {
        const stream = this.eventStore.readAggregateStream(
          AGGREGATE,
          aggregateId,
          instance.acknowledgedRevision + 1n
        );

        for await (const fact of stream) {
          const serializer = this.getSerializer(fact.type);
          const event = await serializer.deserialize(fact);
          instance.load(event as any);
        }

        return instance;
      }

      return super.load(aggregateId) as any;
    }
  };
}
