import {
  Checkpoint,
  EsAggregatePersistor,
  EsProjectedStreamReader,
  EventStore,
  IsolatedProjector,
  TransactionPerformer,
} from "@ddd-ts/event-sourcing";
import { ISerializer } from "@ddd-ts/event-sourcing/dist/model/serializer";
import { Store } from "@ddd-ts/event-sourcing/dist/model/store";
import { CashFlowProjection } from "../app/application/cashflow.projection";
import { Account } from "../app/domain/account/account";
import { CashflowSerializer } from "../app/infrastructure/cashflow.serializer";

function WriteModelConsistencySuite(es: EventStore) {
  describe("Write model consistency", () => {
    class AccountPersistor extends EsAggregatePersistor(Account) {}
    const persistor = new AccountPersistor(es);

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
  snapshotter: <S extends ISerializer<any, any, any>>(
    serializer: S,
    name: string
  ) => Store<
    S extends ISerializer<infer M, any, any> ? M : never,
    S extends ISerializer<any, infer I, any> ? I : never
  >
) {
  const cashflowStore = snapshotter(new CashflowSerializer(), "cashflow");
  const cashflowProjection = new CashFlowProjection(cashflowStore);
  const projectedStreamReader = new EsProjectedStreamReader(es);

  const cashflowProjector = new IsolatedProjector(
    cashflowProjection,
    projectedStreamReader,
    checkpoint,
    transaction
  );

  class AccountPersistor extends EsAggregatePersistor(Account) {}

  const persistor = new AccountPersistor(es);

  beforeAll(async () => {
    await (checkpoint as any).clear();
    await cashflowStore.delete("global");
    await (es as any).clear();
    void cashflowProjector.start();
  });

  beforeEach(async () => {
    await (checkpoint as any).clear();
    await cashflowStore.delete("global");
    await (es as any).clear();
  });

  afterAll(async () => {
    await cashflowProjector.stop();
    await (es as any).close();
  });

  it("should deposit money", async () => {
    const accountA = Account.new();

    accountA.deposit(100);
    await persistor.persist(accountA);

    accountA.deposit(50);
    accountA.deposit(100);
    await persistor.persist(accountA);

    const reloaded = await persistor.load(accountA.id);

    expect(reloaded).toEqual(accountA);
    expect(reloaded.balance).toBe(250);
  });

  it("should maintain a cashflow", async () => {
    const accountA = Account.new();
    accountA.deposit(100);
    await persistor.persist(accountA);

    const accountB = Account.new();
    accountB.deposit(100);
    await persistor.persist(accountB);

    await new Promise((r) => setTimeout(r, 1000));

    const flow = await cashflowStore.load("global");

    expect(flow?.flow).toBe(200);
    expect(true).toBe(true);
  }, 5000);
}
