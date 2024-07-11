import { EsAggregateStoreSuite } from "@ddd-ts/tests";
import { InMemoryEventStore } from "./in-memory.event-store";
import type { HasTrait } from "@ddd-ts/traits";
import {
  AutoSerializer,
  EsAggregate,
  EsEvent,
  On,
  SerializerRegistry,
  type EventSourced,
  type Identifiable,
} from "@ddd-ts/core";
import type { IEvent, IEventBus, ISerializer } from "@ddd-ts/core";
import { InMemorySnapshotter } from "../in-memory.snapshotter";
import {
  InMemoryDatabase,
  InMemoryStore,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";
import { MakeInMemoryEsAggregateStore } from "../in-memory.es-aggregate-store";
import { Shape } from "../../../shape/dist";

describe("InMemoryEventStore", () => {
  const database = new InMemoryDatabase();
  const transaction = new InMemoryTransactionPerformer(database);
  const eventStore = new InMemoryEventStore();
  function makeAggregateStore<
    T extends HasTrait<typeof EventSourced> & HasTrait<typeof Identifiable>,
  >(
    AGGREGATE: T,
    eventSerializer: ISerializer<InstanceType<T>["changes"][number]>,
    serializer: ISerializer<InstanceType<T>>,
  ) {
    const snapshotter = new InMemorySnapshotter(
      AGGREGATE.name,
      database,
      serializer,
    );

    const Store = MakeInMemoryEsAggregateStore(AGGREGATE);

    return new Store(eventStore, transaction, eventSerializer, snapshotter);
  }
  EsAggregateStoreSuite(makeAggregateStore);

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

    class AccountOpened extends EsEvent("AccountOpened", {
      id: String,
      index: Number,
      registryId: String,
    }) {}

    class Account extends EsAggregate("Account", {
      events: [AccountOpened],
      state: {
        id: String,
        index: Number,
        balance: Number,
        registryId: String,
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

      static open(registryId: string, index: number) {
        return this.new(
          AccountOpened.new({
            id: Math.random().toString(36).slice(2),
            index,
            registryId,
          }),
        );
      }
    }

    class AccountRegistry extends Shape({
      id: String,
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
          id: Math.random().toString().slice(2),
          index: 0,
        });
      }
    }

    const registryStore = new InMemoryStore(
      "account-registry",
      database,
      new (AutoSerializer(AccountRegistry, 1))(),
    );

    const accountStore = new (MakeInMemoryEsAggregateStore(Account))(
      eventStore,
      transaction,
      new SerializerRegistry().add(
        AccountOpened,
        new (AutoSerializer(AccountOpened, 1))(),
      ),
      new InMemorySnapshotter(
        Account.name,
        database,
        new (AutoSerializer(Account, 1))(),
      ),
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

    const result = await accountStore.snapshotter?.filter(
      (a) => a.registryId === registry.id,
    );
    const documents = result;

    expect(documents?.length).toBe(30);

    const indices = documents
      ?.map((doc) => Number(doc.index))
      .sort((a, b) => a - b);

    expect(indices).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
  });
});
