import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Account } from "../test/app/domain/account/account";
import { AccountId } from "../test/app/domain/account/account-id";
import { Constructor, EventStore } from "./event-store/event-store";

export abstract class EsAggregatePersistor<A extends EsAggregate> {
  constructor(private eventStore: EventStore) {}

  abstract AGGREGATE: Constructor<A> & { instanciate: (id: A["id"]) => A };

  async persist(aggregate: A) {
    await this.eventStore.appendToAggregateStream(
      aggregate.constructor as Constructor<A>,
      aggregate.id,
      aggregate.changes,
      aggregate.acknowledgedRevision
    );
    aggregate.acknowledgeChanges();
  }

  async load(aggregateId: A["id"]): Promise<A> {
    const account = this.AGGREGATE.instanciate(aggregateId);
    const stream = this.eventStore.readAggregateStream(Account, aggregateId);

    for await (const fact of stream) {
      account.load(fact as any);
    }

    return account;
  }

  static for<A extends EsAggregate>(
    AGGREGATE: Constructor<A> & { instanciate: (id: A["id"]) => A }
  ) {
    return class extends EsAggregatePersistor<A> {
      AGGREGATE = AGGREGATE;
    };
  }
}
