import {
  EsAggregate,
  ESDBEventStore,
  EsAggregatePersistor,
  Projection,
  Fact,
} from "@ddd-ts/event-sourcing";
import { Value } from "@ddd-ts/value";
import { Event } from "@ddd-ts/value-event";
import { v4 } from "uuid";

class Id extends Value(String) {
  static generate() {
    return new Id(v4());
  }
  toString() {
    return this.value;
  }
}

class AccountId extends Id {}

class Money extends Value(Number) {}

class Deposited extends Event({ AccountId, amount: Money }) {}
class Created extends Event({ AccountId }) {}

class Account extends EsAggregate<AccountId> {
  deposit(amount: Money) {
    this.apply(Deposited.newChange({ AccountId: this.id, amount }));
  }

  static new() {
    const account = new Account(AccountId.generate());
    account.apply(Created.newChange({ AccountId: account.id }));
    return account;
  }
}

async function CreateAccountCommand(persistor: EsAggregatePersistor<Account>) {
  const account = Account.new();
  await persistor.persist(account);
  return account.id;
}

async function RefillAccountCommand(
  persistor: EsAggregatePersistor<Account>,
  id: AccountId,
  amount: Money
) {
  const account = await persistor.load(id);

  account.deposit(amount);

  await persistor.persist(account);
}

class InMemoryTotalProjectionStore {}

class AccountTotalProjection extends Projection {
  AGGREGATE = Account;

  constructor(private readonly persistor);

  @Projection.on(Deposited)
  async onDeposited(deposited: Fact<Deposited>) {}
}

async function boot() {
  const es = new ESDBEventStore();
  const persistor = new (EsAggregatePersistor.for(Account))(es);

  const account = Account.new();

  account.deposit(new Money(10));

  await persistor.persist(account);

  await es.close();
}

boot();

function queue<T>() {
  const pushQueue: T[] = [];
  const pullQueue: Array<(i: T) => any> = [];

  function push(i: T) {
    const resolve = pullQueue.shift();
    if (resolve) {
      resolve(i);
    } else {
      pushQueue.push(i);
    }
  }

  async function* iterator() {
    while (true) {
      const i = pushQueue.shift();
      if (i) {
        yield i;
      } else {
        yield new Promise((resolve) => {
          pullQueue.push(resolve);
        });
      }
    }
  }

  return [push, iterator] as const;
}

async function* merge(
  first: AsyncIterableIterator<number>,
  second: AsyncIterableIterator<number>
) {
  const [push, iterator] = queue<number>();

  (async () => {
    for await (const i of first) {
      push(i);
    }
  })();

  (async () => {
    for await (const i of first) {
      push(i);
    }
  })();

  yield* iterator();
}

async function go() {
  for await (const i of merge(a, b)) {
    console.log(i);
  }
}
