import { Constructor } from "@ddd-ts/types";
import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Snapshotter } from "../index";
import { EventStore } from "./event-store";

export type EsAggregateType<A extends EsAggregate> = Constructor<A> & {
  instanciate: (id: A["id"]) => A;
};

export interface EsAggregatePersistor<A extends EsAggregate> {
  persist(aggregate: A): Promise<void>;
  load(aggregateId: A["id"]): Promise<A>;
}

export function EsAggregatePersistor<A extends EsAggregateType<any>>(
  AGGREGATE: A
) {
  return class {
    constructor(public eventStore: EventStore) {}

    async persist(aggregate: InstanceType<A>) {
      await this.eventStore.appendToAggregateStream(
        AGGREGATE,
        aggregate.id,
        aggregate.changes,
        aggregate.acknowledgedRevision
      );
      aggregate.acknowledgeChanges();
    }

    async load(aggregateId: InstanceType<A>["id"]): Promise<InstanceType<A>> {
      const instance = AGGREGATE.instanciate(aggregateId);
      const stream = this.eventStore.readAggregateStream(
        AGGREGATE,
        aggregateId
      );

      for await (const fact of stream) {
        instance.load(fact as any);
      }

      return instance;
    }
  };
}

export function EsAggregatePersistorWithSnapshots<
  A extends EsAggregateType<any>
>(AGGREGATE: A) {
  return class extends EsAggregatePersistor(AGGREGATE) {
    constructor(
      eventStore: EventStore,
      public snapshotter: Snapshotter<InstanceType<A>>
    ) {
      super(eventStore);
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
          instance.load(fact as any);
        }

        return instance;
      }

      return super.load(aggregateId);
    }
  };
}
