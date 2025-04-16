process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import {
  AutoSerializer,
  EsAggregate,
  EsEvent,
  EventsOf,
  On,
  SerializerRegistry,
  type EventSourced,
  type Identifiable,
  type IEvent,
  type IEventBus,
  type ISerializer,
} from "@ddd-ts/core";
import type { HasTrait } from "@ddd-ts/traits";
import {
  FirestoreStore,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { EsAggregateStoreSuite } from "@ddd-ts/tests";

import { MakeFirestoreEsAggregateStore } from "./firestore.es-aggregate-store";
import { FirestoreSnapshotter } from "./firestore.snapshotter";
import { Primitive, Shape } from "@ddd-ts/shape";
import { FirestoreEventStreamStore } from "./firestore.event-stream.store";

jest.setTimeout(10000);

describe("FirestoreEsAggregateStore", () => {
  const app = fb.initializeApp({
    projectId: "demo-es",
  });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);

  function makeAggregateStore<
    T extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  >(
    AGGREGATE: T,
    eventSerializer: SerializerRegistry.For<EventsOf<T>>,
    serializer: ISerializer<InstanceType<T>>,
  ) {
    const snapshotter = new FirestoreSnapshotter(
      AGGREGATE.name,
      firestore,
      serializer,
    );
    const Store = MakeFirestoreEsAggregateStore(AGGREGATE);
    const streamStore = new FirestoreEventStreamStore(
      firestore,
      eventSerializer,
    );
    return new Store(streamStore, transaction, snapshotter);
  }

  class AccountId extends Primitive(String) {}

  EsAggregateStoreSuite(makeAggregateStore);

  describe("Account alone", () => {
    class AccountOpened extends EsEvent("AccountOpened", {
      id: AccountId,
    }) {}

    class Deposited extends EsEvent("Deposited", {
      id: AccountId,
      amount: Number,
    }) {}

    class Account extends EsAggregate("Account", {
      events: [AccountOpened, Deposited],
      state: {
        id: AccountId,
        balance: Number,
      },
    }) {
      @On(AccountOpened)
      static onAccountOpened(event: AccountOpened) {
        return new Account({
          id: event.payload.id,
          balance: 0,
        });
      }

      @On(Deposited)
      onDeposited(event: Deposited) {
        this.balance += event.payload.amount;
      }

      deposit(amount: number) {
        this.apply(Deposited.new({ id: this.id, amount }));
      }

      static open() {
        return this.new(
          AccountOpened.new({
            id: new AccountId(Math.random().toString(36).slice(2)),
          }),
        );
      }
    }

    const registry = new SerializerRegistry()
      .auto(AccountOpened)
      .add(Deposited, new (AutoSerializer.First(Deposited))())
      .add(Account, new (AutoSerializer(Account, 1))());

    const accountStore = makeAggregateStore(
      Account,
      registry,
      AutoSerializer.first(Account),
    );

    it("should be fast", async () => {
      const accounts = [...Array(200).keys()].map(() => Account.open());

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

    it("should allow heavily concurrent writes", async () => {
      const account = Account.open();

      await accountStore.save(account);

      await Promise.all(
        [...Array(20).keys()].map(async (i) => {
          const fresh = await accountStore.load(account.id);
          fresh!.deposit(1);
          await accountStore.save(fresh!);
        }),
      );

      const fresh = await accountStore.load(account.id);
      expect(fresh!.balance).toBe(20);
    });

    it("should not update the snapshot if no changes are made (concurrency issues)", async () => {
      const account = Account.open();

      await accountStore.save(account);

      const wait = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      await Promise.all([
        (async () => {
          const acc = await accountStore.load(account.id);
          await wait(10);
          await accountStore.save(acc!);
        })(),
        (async () => {
          const acc = await accountStore.load(account.id);
          acc!.deposit(1);
          await accountStore.save(acc!);
        })(),
      ]);

      const fresh = await accountStore.load(account.id);
      console.log(fresh!.id);
      expect(fresh!.balance).toBe(1);
    });
  });

  it("should support saveAll with transactions", async () => {
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

    class AccountRegistryId extends Primitive(String) {}

    class AccountOpened extends EsEvent("AccountOpened", {
      id: AccountId,
      index: Number,
      registryId: AccountRegistryId,
    }) {}

    class Account extends EsAggregate("Account", {
      events: [AccountOpened],
      state: {
        id: AccountId,
        index: Number,
        balance: Number,
        registryId: AccountRegistryId,
      },
    }) {
      @On(AccountOpened)
      static onAccountOpened(event: AccountOpened) {
        return new Account({
          id: event.payload.id,
          index: event.payload.index,
          balance: 0,
          registryId: event.payload.registryId,
        });
      }

      static open(registryId: AccountRegistryId, index: number) {
        return this.new(
          AccountOpened.new({
            id: new AccountId(Math.random().toString(36).slice(2)),
            index,
            registryId,
          }),
        );
      }
    }

    class AccountRegistry extends Shape({
      id: AccountRegistryId,
      index: Number,
    }) {
      increment(shouldFailInMiddle = false) {
        this.index++;
        if (this.index > 10 && shouldFailInMiddle) {
          throw new Error("Too many accounts");
        }
        return this.index;
      }

      static new() {
        return new AccountRegistry({
          id: AccountRegistryId.deserialize(Math.random().toString().slice(2)),
          index: 0,
        });
      }
    }

    const registryStore = new FirestoreStore(
      "account-registry",
      firestore,
      new (AutoSerializer(AccountRegistry, 1))(),
    );

    const accountStore = makeAggregateStore(
      Account,
      new SerializerRegistry().auto(AccountOpened),
      AutoSerializer.first(Account),
    );

    const eventBus = new MockEventBus();
    accountStore.publishEventsTo(eventBus);

    const registry = AccountRegistry.new();
    await registryStore.save(registry);

    let willFailForAttempt = 3;
    await transaction.perform(async (trx) => {
      willFailForAttempt--;
      const reg = await registryStore.load(registry.id, trx);

      const accounts = [...Array(30).keys()].map((i) =>
        Account.open(registry.id, reg!.increment(willFailForAttempt === 0)),
      );

      await accountStore.saveAll(accounts, trx);
      await registryStore.save(reg!, trx);
    });

    const freshRegistry = await registryStore.load(registry.id);

    expect(freshRegistry!.index).toBe(30);

    const result = await accountStore.snapshotter?.collection
      .where("registryId", "==", registry.id.serialize())
      .get();
    const documents = result?.docs.map((doc) => doc.data());

    expect(documents?.length).toBe(30);

    const indices = documents
      ?.map((doc: any) => Number(doc.index))
      .sort((a, b) => a - b);

    expect(indices).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);

    expect(eventBus.events.length).toBe(30);
  });

  it("should support saveAll with transactions", async () => {
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

    class AccountRegistryId extends Primitive(String) {}

    class AccountOpened extends EsEvent("AccountOpened", {
      id: AccountId,
      index: Number,
      registryId: AccountRegistryId,
    }) {}

    class Account extends EsAggregate("Account", {
      events: [AccountOpened],
      state: {
        id: AccountId,
        index: Number,
        balance: Number,
        registryId: AccountRegistryId,
      },
    }) {
      @On(AccountOpened)
      static onAccountOpened(event: AccountOpened) {
        return new Account({
          id: event.payload.id,
          index: event.payload.index,
          balance: 0,
          registryId: event.payload.registryId,
        });
      }

      static open(registryId: AccountRegistryId, index: number) {
        return this.new(
          AccountOpened.new({
            id: new AccountId(Math.random().toString(36).slice(2)),
            index,
            registryId,
          }),
        );
      }
    }

    class AccountRegistry extends Shape({
      id: AccountRegistryId,
      index: Number,
    }) {
      increment(shouldFailInMiddle = false) {
        this.index++;
        if (this.index > 10 && shouldFailInMiddle) {
          throw new Error("Too many accounts");
        }
        return this.index;
      }

      static new() {
        return new AccountRegistry({
          id: AccountRegistryId.deserialize(Math.random().toString().slice(2)),
          index: 0,
        });
      }
    }

    const registryStore = new FirestoreStore(
      "account-registry",
      firestore,
      new (AutoSerializer(AccountRegistry, 1))(),
    );

    const accountStore = makeAggregateStore(
      Account,
      new SerializerRegistry().auto(AccountOpened),
      AutoSerializer.first(Account),
    );

    const eventBus = new MockEventBus();
    accountStore.publishEventsTo(eventBus);

    const registry = AccountRegistry.new();
    await registryStore.save(registry);

    await Promise.all([
      transaction.perform(async (trx) => {
        const reg = await registryStore.load(registry.id, trx);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const account = Account.open(registry.id, reg!.increment());

        await accountStore.save(account, trx);
        await registryStore.save(reg!, trx);
      }),
      transaction.perform(async (trx) => {
        await new Promise((resolve) => setTimeout(resolve, 40));

        const reg = await registryStore.load(registry.id, trx);

        const account = Account.open(registry.id, reg!.increment());

        await accountStore.save(account, trx);
        await registryStore.save(reg!, trx);
      }),
    ]);

    const freshRegistry = await registryStore.load(registry.id);

    expect(freshRegistry!.index).toBe(2);

    const result = await accountStore.snapshotter?.collection
      .where("registryId", "==", registry.id.serialize())
      .get();
    const documents = result?.docs.map((doc) => doc.data());

    expect(documents?.length).toBe(2);

    const indices = documents
      ?.map((doc: any) => Number(doc.index))
      .sort((a, b) => a - b);

    expect(indices).toEqual([1, 2]);

    expect(eventBus.events.length).toBe(2);
  });
});
