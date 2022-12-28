import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Constructor, EventStore } from "./event-store/event-store";

type EsAggregateType<A extends EsAggregate> = Constructor<A> & {
  instanciate: (id: A["id"]) => A;
};

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
