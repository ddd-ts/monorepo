import {
  AutoSerializer,
  ISerializer,
  SerializerRegistry,
  EventBusProjectionProcessor,
  type Store,
  type EventSourced,
  type IEsAggregateStore,
  type IEventBus,
  type Identifiable,
  type IIdentifiable,
  EventsOf,
} from "@ddd-ts/core";
import type { Constructor } from "@ddd-ts/types";
import type { HasTrait } from "@ddd-ts/traits";

import { CashFlowProjection } from "../app/application/cashflow.projection";
import { Account, AccountOpened } from "../app/domain/write/account/account";
import {
  AccountSerializer,
  DepositedSerializer,
  WithdrawnSerializer,
} from "../app/infrastructure/account.serializer";
import { CashflowSerializer } from "../app/infrastructure/cashflow.serializer";
import {
  Deposited,
  Withdrawn,
} from "../app/domain/write/account/deposited.event";

// function WriteModelConsistencySuite(es: IEventStore) {
//   describe("Write model consistency", () => {
//     // class AccountStore extends EsAggregateStore(Account) {}
//     const serializers = new SerializerRegistry()
//       .add(Deposited, new DepositedSerializer())
//       .add(Withdrawn, new WithdrawnSerializer());

//     const store = new AccountStore(es, serializers);

//     it("should allow to save a new account", async () => {
//       const account = Account.open();
//       account.deposit(100);
//       account.deposit(200);
//       account.deposit(300);

//       await store.save(account);

//       const loadedAccount = await store.load(account.id);
//       expect(loadedAccount).toEqual(account);
//     });

//     it("should allow to manipulate an account and save it", async () => {
//       const account = Account.open();
//       account.deposit(100);
//       account.deposit(200);
//       account.deposit(300);

//       await store.save(account);

//       account.deposit(100);
//       account.deposit(200);
//       account.deposit(300);

//       await store.save(account);

//       const loadedAccount = await store.load(account.id);
//       expect(loadedAccount).toEqual(account);
//     });

//     it("should not allow to work with an outdated account reference", async () => {
//       const account = Account.open();
//       account.deposit(100);

//       await store.save(account);

//       const otherReference = await store.load(account.id);
//       if (!otherReference) throw new Error("Account not found");

//       otherReference.deposit(100);
//       await store.save(otherReference); // persistance means depreciation of other references

//       const outdatedReference = account;
//       outdatedReference.deposit(100);

//       await expect(store.save(outdatedReference)).rejects.toThrow();
//     });
//   });
// }

// biome-ignore lint/suspicious/noExportsInTest: <explanation>
export function BankSuite(
  // es: IEventStore,
  eventBus: IEventBus,
  // checkpoint: Checkpoint,
  // transaction: TransactionPerformer,
  createStore: <S extends ISerializer<any>>(
    serializer: S,
    name: string,
  ) => Store<S extends ISerializer<infer M> ? M : never>,
  createPersistor: <
    A extends HasTrait<typeof EventSourced> & Constructor<IIdentifiable>,
  >(
    AGGREGATE: A,
    serializer: ISerializer<InstanceType<A>>,
    eventSerializers: SerializerRegistry.For<EventsOf<A>>,
  ) => IEsAggregateStore<InstanceType<A>>,
) {
  // const cashflowStore = createStore(new CashflowSerializer(), "cashflow");
  // const cashflowProjection = new CashFlowProjection(cashflowStore);
  // // const projectedStreamReader = new EsProjectedStreamReader<
  // //   CashFlowProjection["on"]
  // // >(es, [[new DepositedSerializer(), new WithdrawnSerializer()]]);

  // const cashflowProjector = new EventBusProjectionProcessor(
  //   cashflowProjection,
  //   eventBus,
  //   // projectedStreamReader,
  //   // checkpoint,
  //   // transaction,
  // );

  /**
   * boot <- return { registry: registry ( merge de tous les autres regitry ) }
   *  account.events.ts
   *  desposited/
   *    deposited.serializer.ts <- when updating the event, automatically import upcaster
   *    deposited.0.ts <- when creating the event
   *    deposited.1.ts <- when updating the event
   *    deposited.0to1.upcaster.ts <- does not compile by default, create compensation
   *
   * registry.add(new DepositedSerializer())
   *
   * freeze/
   *   index.ts <- { freeze(registry) }
   *   frozen-registry.ts <- auto managed
   *   events/
   *      deposited/
   *        deposited.serialized.1n.ts
   *        deposited.serialized.2n.ts
   */

  const store = createPersistor(
    Account,
    new AccountSerializer(),
    new SerializerRegistry()
      .add(Deposited, new DepositedSerializer())
      .add(Withdrawn, new WithdrawnSerializer())
      .add(AccountOpened, new (AutoSerializer(AccountOpened, 1))()),
  );

  // beforeEach(async () => {
  //   await cashflowProjector.stop();
  //   // await checkpoint.clear();
  //   await cashflowStore.delete("global");
  //   // await es.clear();
  //   await cashflowProjector.start();
  // });

  // afterAll(async () => {
  //   await cashflowProjector.stop();
  //   // await es.close();
  // });

  it("should deposit money", async () => {
    const accountA = Account.open();

    accountA.deposit(100);
    await store.save(accountA);

    accountA.deposit(50);
    accountA.deposit(200);
    await store.save(accountA);

    const reloaded = await store.load(accountA.id);

    expect(reloaded).toEqual(accountA);
    expect(reloaded?.balance).toBe(350);
  });

  // it.skip("should maintain a cashflow", async () => {
  //   const accountA = Account.open();
  //   accountA.deposit(100);
  //   await store.save(accountA);

  //   const accountB = Account.open();
  //   accountB.deposit(100);
  //   await store.save(accountB);

  //   await new Promise((r) => setTimeout(r, 100));

  //   const flow = await cashflowStore.load("global");

  //   expect(flow?.flow).toBe(200);
  // });

  it("should load a big account", async () => {
    const account = Account.open();
    for (let i = 0; i < 400; i++) {
      account.deposit(100);
    }
    await store.save(account);
    for (let i = 0; i < 400; i++) {
      account.deposit(100);
    }
    await store.save(account);
    const reloaded = await store.load(account.id);

    expect(reloaded).toEqual(account);
    expect(reloaded?.balance).toBe(80000);
  });
}
