import {
  Checkpoint,
  EsAggregatePersistor,
  EsAggregateType,
  EsProjectedStreamReader,
  EventStore,
  IsolatedProjector,
} from "@ddd-ts/event-sourcing";
import { AllEventSerializers } from "@ddd-ts/event-sourcing/dist/es-aggregate-store/es-aggregate.persistor";
import { Serializer, Store, TransactionPerformer } from "@ddd-ts/model";
import { CashFlowProjection } from "../app/application/cashflow.projection";
import { Account } from "../app/domain/write/account/account";
import {
  AccountSerializer,
  DepositedSerializer,
  WithdrawnSerializer,
} from "../app/infrastructure/account.serializer";
import { CashflowSerializer } from "../app/infrastructure/cashflow.serializer";

function WriteModelConsistencySuite(es: EventStore) {
  describe("Write model consistency", () => {
    class AccountPersistor extends EsAggregatePersistor(Account) {}
    const persistor = new AccountPersistor(es, [
      new DepositedSerializer(),
      new WithdrawnSerializer(),
    ]);

    it("should allow to save a new account", async () => {
      const account = Account.new();
      account.deposit(100);
      account.deposit(200);
      account.deposit(300);

      await persistor.persist(account);

      const loadedAccount = await persistor.load(account.id);
      expect(loadedAccount).toEqual(account);
    });

    it("should allow to manipulate an account and save it", async () => {
      const account = Account.new();
      account.deposit(100);
      account.deposit(200);
      account.deposit(300);

      await persistor.persist(account);

      account.deposit(100);
      account.deposit(200);
      account.deposit(300);

      await persistor.persist(account);

      const loadedAccount = await persistor.load(account.id);
      expect(loadedAccount).toEqual(account);
    });

    it("should not allow to work with an outdated account reference", async () => {
      const account = Account.new();
      account.deposit(100);

      await persistor.persist(account);

      const otherReference = await persistor.load(account.id);
      otherReference.deposit(100);
      await persistor.persist(otherReference); // persistance means depreciation of other references

      const outdatedReference = account;
      outdatedReference.deposit(100);

      await expect(persistor.persist(outdatedReference)).rejects.toThrow();
    });
  });
}

export function BankSuite(
  es: EventStore,
  checkpoint: Checkpoint,
  transaction: TransactionPerformer,
  createStore: <S extends Serializer<any>>(
    serializer: S,
    name: string
  ) => Store<
    S extends Serializer<infer M> ? M : never,
    S extends Serializer<any> ? ReturnType<S["getIdFromModel"]> : never
  >,
  createPersistor: <A extends EsAggregateType<any>>(
    AGGREGATE: A,
    serializer: Serializer<InstanceType<A>>,
    eventSerializers: AllEventSerializers<InstanceType<A>>
  ) => EsAggregatePersistor<InstanceType<A>>
) {
  const cashflowStore = createStore(new CashflowSerializer(), "cashflow");
  const cashflowProjection = new CashFlowProjection(cashflowStore);
  const projectedStreamReader = new EsProjectedStreamReader<
    CashFlowProjection["on"]
  >(es, [[new DepositedSerializer(), new WithdrawnSerializer()]]);

  const cashflowProjector = new IsolatedProjector(
    cashflowProjection,
    projectedStreamReader,
    checkpoint,
    transaction
  );

  const persistor = createPersistor(Account, new AccountSerializer(), [
    new DepositedSerializer(),
    new WithdrawnSerializer(),
  ] as const);

  beforeEach(async () => {
    await cashflowProjector.stop();
    await checkpoint.clear();
    await cashflowStore.delete("global");
    await es.clear();
    await cashflowProjector.start();
  });

  afterAll(async () => {
    await cashflowProjector.stop();
    await es.close();
  });

  it("should deposit money", async () => {
    const accountA = Account.new();

    accountA.deposit(100);
    await persistor.persist(accountA);

    accountA.deposit(50);
    accountA.deposit(200);
    await persistor.persist(accountA);

    const reloaded = await persistor.load(accountA.id);

    expect(reloaded).toEqual(accountA);
    expect(reloaded.balance).toBe(350);
  });

  it("should maintain a cashflow", async () => {
    const accountA = Account.new();
    accountA.deposit(100);
    await persistor.persist(accountA);

    const accountB = Account.new();
    accountB.deposit(100);
    await persistor.persist(accountB);

    await new Promise((r) => setTimeout(r, 100));

    const flow = await cashflowStore.load("global");

    expect(flow?.flow).toBe(200);
  });

  it("should load a big account", async () => {
    const account = Account.new();
    for (let i = 0; i < 500; i++) {
      account.deposit(100);
    }
    await persistor.persist(account);
    for (let i = 0; i < 500; i++) {
      account.deposit(100);
    }
    await persistor.persist(account);
    const reloaded = await persistor.load(account.id);

    expect(reloaded).toEqual(account);
    expect(reloaded.balance).toBe(100000);
  });
}
