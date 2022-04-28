import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Account, AccountId } from "../test";
import { Constructor, EventStore } from "./event-store/event-store";

export class EsAccountPersistor<A extends EsAggregate> {
  constructor(private eventStore: EventStore) {}

  async persist(aggregate: A) {
    await this.eventStore.appendToAggregateStream(
      aggregate.constructor as Constructor<A>,
      aggregate.id,
      aggregate.changes,
      aggregate.acknowledgedRevision
    );
    aggregate.acknowledgeChanges();
  }

  async load(accountId: AccountId): Promise<Account> {
    const account = new Account(accountId);
    const stream = this.eventStore.readAggregateStream(Account, accountId);
    for await (const fact of stream) {
      account.load(fact);
    }
    return account;
  }
}
