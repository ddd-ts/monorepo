import { Primitive } from "@ddd-ts/shape";
import { EsEvent } from "../makers/es-event";
import { EsAggregate } from "../makers/es-aggregate";
import { On } from "../decorators/handlers";
import { EventId } from "./event-id";
import { SerializerRegistry } from "./serializer-registry";
import { TransactionPerformer } from "./transaction";
import type { ISerializer } from "../interfaces/serializer";
import type { Store } from "../interfaces/store";
import type { IIdentifiable } from "../interfaces/identifiable";
import { type EventOf, EventSourced } from "../traits/event-sourced";
import type { IEventBus } from "../interfaces/event-bus";
import { AutoSerializer } from "./auto-serializer";
import { Shaped } from "../traits/shaped";
import { Derive, type HasTrait } from "@ddd-ts/traits";
import { Named } from "../traits/named";
import type { IEvent } from "../interfaces/event";
import { Identifiable } from "../traits/identifiable";
import type { IEsAggregateStore } from "../interfaces/es-aggregate-store";

export function EventLakeAggregateStoreSuite(config: {
  transaction: TransactionPerformer;
  getAggregateStore: <
    T extends HasTrait<typeof Identifiable> & HasTrait<typeof EventSourced>,
  >(
    AGGREGATE: T,
    serializer: ISerializer<InstanceType<T>> &
      ISerializer<EventOf<InstanceType<T>>>,
    eventBus?: IEventBus,
  ) => IEsAggregateStore<InstanceType<T>>;
  getStore: <T extends IIdentifiable>(
    name: string,
    serializer: ISerializer<T>,
  ) => Store<T>;
}) {
  class AccountId extends Primitive(String) {
    static generate() {
      return new AccountId(`A${EventId.generate().serialize().slice(0, 8)}`);
    }
  }

  class BankId extends Primitive(String) {
    static generate() {
      return new BankId(`B${EventId.generate().serialize().slice(0, 8)}`);
    }
  }

  class AccountOpened extends EsEvent("AccountOpened", {
    accountId: AccountId,
    bankId: BankId,
    index: Number,
  }) {}

  class Deposited extends EsEvent("Deposited", {
    accountId: AccountId,
    bankId: BankId,
    amount: Number,
  }) {}

  class Withdrawn extends EsEvent("Withdrawn", {
    accountId: AccountId,
    bankId: BankId,
    amount: Number,
  }) {}

  class Account extends EsAggregate("Account", {
    events: [AccountOpened, Deposited, Withdrawn],
    state: {
      id: AccountId,
      bankId: BankId,
      index: Number,
      balance: Number,
    },
  }) {
    static open() {
      return this.new(
        AccountOpened.new({
          accountId: AccountId.generate(),
          bankId: BankId.generate(),
          index: 0,
        }),
      );
    }

    static openIndexed(bankId: BankId, index: number) {
      return this.new(
        AccountOpened.new({
          accountId: AccountId.generate(),
          bankId,
          index,
        }),
      );
    }

    @On(AccountOpened)
    static onAccountOpened(event: AccountOpened) {
      return new Account({
        id: event.payload.accountId,
        bankId: event.payload.bankId,
        index: event.payload.index,
        balance: 0,
      });
    }

    deposit(amount: number) {
      this.apply(
        Deposited.new({ accountId: this.id, bankId: this.bankId, amount }),
      );
    }

    @On(Deposited)
    onDeposited(event: Deposited) {
      this.balance += event.payload.amount;
    }

    withdraw(amount: number) {
      this.apply(
        Withdrawn.new({ accountId: this.id, bankId: this.bankId, amount }),
      );
    }

    @On(Withdrawn)
    onWithdrawn(event: Withdrawn) {
      this.balance -= event.payload.amount;
    }
  }

  class Bank extends Derive(
    Named("Bank"),
    Shaped({
      id: BankId,
      accounts: Number,
    }),
  ) {
    increment(shouldFailInMiddle = false) {
      this.accounts++;
      if (this.accounts > 10 && shouldFailInMiddle) {
        throw new Error("Too many accounts");
      }
      return this.accounts;
    }

    static new() {
      return new Bank({
        id: BankId.generate(),
        accounts: 0,
      });
    }
  }

  const registry = new SerializerRegistry()
    .auto(AccountOpened)
    .auto(Deposited)
    .auto(Withdrawn)
    .auto(Account)
    .auto(Bank);

  const bankStore = config.getStore("Bank", AutoSerializer.first(Bank));

  it("save and load", async () => {
    const accountStore = config.getAggregateStore(Account, registry);
    const account = Account.open();
    await accountStore.save(account);
    const loadedAccount = await accountStore.load(account.id);
    expect(loadedAccount).toEqual(account);
    expect(loadedAccount?.balance).toEqual(0);
  });

  it("supports concurrent writes, using transactions", async () => {
    const accountStore = config.getAggregateStore(Account, registry);
    const account = Account.open();
    await accountStore.save(account);

    await Promise.all(
      [...Array(5).keys()].map(async () => {
        await config.transaction.perform(async (trx) => {
          const fresh = await accountStore.load(account.id, trx);
          fresh!.deposit(1);
          await accountStore.save(fresh!, trx);
        });
      }),
    );

    const loadedAccount = await accountStore.load(account.id);
    expect(loadedAccount?.balance).toEqual(5);
  });

  it("is fast", async () => {
    const accountStore = config.getAggregateStore(Account, registry);

    const accounts = [...Array(100).keys()].map(() => Account.open());

    const expectMS = async (ms: number, fn: () => Promise<any>) => {
      const before = process.hrtime.bigint();
      await fn();
      const after = process.hrtime.bigint();
      expect(Number(after - before) / 1_000_000).toBeLessThan(ms);
    };

    await expectMS(5000, async () => {
      for (const account of accounts) {
        await accountStore.save(account);
      }
    });

    await expectMS(5000, async () => {
      for (const account of accounts) {
        await accountStore.load(account.id);
      }
    });
  });

  it("supports saveAll", async () => {
    const accountStore = config.getAggregateStore(Account, registry);

    const accounts = [...Array(10).keys()].map(() => Account.open());
    await accountStore.saveAll(accounts);

    const loadedAccounts = await Promise.all(
      accounts.map((account) => accountStore.load(account.id)),
    );

    expect(loadedAccounts).toEqual(accounts);
  });

  class MockEventBus implements IEventBus {
    off(): void {
      throw new Error("Method not implemented.");
    }
    on() {
      throw new Error("Method not implemented.");
    }

    events: IEvent[] = [];

    publish(event: IEvent) {
      this.events.push(event);
      return Promise.resolve();
    }
  }
  it("should support saveAll with transactions", async () => {
    const eventBus = new MockEventBus();
    const accountStore = config.getAggregateStore(Account, registry, eventBus);

    const bank = Bank.new();
    await bankStore.save(bank);

    let willFailForAttempt = 3;
    const saved = await config.transaction.perform(async (trx) => {
      willFailForAttempt--;
      const trxBank = await bankStore.load(bank.id, trx);

      const accounts = [...Array(30).keys()].map((i) =>
        Account.openIndexed(
          bank.id,
          trxBank!.increment(willFailForAttempt === 0),
        ),
      );

      await accountStore.saveAll(accounts, trx);
      await bankStore.save(trxBank!, trx);
      return accounts;
    });

    const freshBank = await bankStore.load(bank.id);

    expect(freshBank!.accounts).toBe(30);

    const freshAccounts = (
      await Promise.all(saved.map((a) => accountStore.load(a.id)))
    ).filter((a) => !!a) as Account[];

    expect(freshAccounts.length).toBe(30);

    const indices = freshAccounts
      .map((doc) => Number(doc.index))
      .sort((a, b) => a - b);

    expect(indices).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);

    expect(eventBus.events.length).toBe(30);
  });

  it("should support crosslocking with transactions", async () => {
    const eventBus = new MockEventBus();
    const accountStore = config.getAggregateStore(Account, registry, eventBus);

    const bank = Bank.new();
    await bankStore.save(bank);

    const accountIds = await Promise.all([
      config.transaction.perform(async (trx) => {
        const bk = await bankStore.load(bank.id, trx);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const account = Account.openIndexed(bank.id, bk!.increment());

        await accountStore.save(account, trx);
        await bankStore.save(bk!, trx);
        return account.id;
      }),
      config.transaction.perform(async (trx) => {
        await new Promise((resolve) => setTimeout(resolve, 40));

        const bk = await bankStore.load(bank.id, trx);

        const account = Account.openIndexed(bank.id, bk!.increment());

        await accountStore.save(account, trx);
        await bankStore.save(bk!, trx);
        return account.id;
      }),
    ]);

    const freshBank = await bankStore.load(bank.id);
    expect(freshBank!.accounts).toBe(2);

    const result = (
      await Promise.all(accountIds.map((id) => accountStore.load(id)))
    ).filter((a) => !!a) as Account[];

    expect(result.length).toBe(2);

    const indices = result
      .map((doc: any) => Number(doc.index))
      .sort((a, b) => a - b);

    expect(indices).toEqual([1, 2]);

    expect(eventBus.events.length).toBe(2);
  });
}
