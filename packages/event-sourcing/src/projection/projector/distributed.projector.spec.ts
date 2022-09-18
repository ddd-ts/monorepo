import { EsAggregatePersistor } from "../../es-aggregate-store/es-aggregate.persistor";
import { EsProjectedStreamReader } from "../../es-aggregate-store/es-projected-stream.reader";
import { ESDBEventStore } from "../../es-aggregate-store/event-store/esdb/esdb.event-store";
import { InMemoryEventStore } from "../../es-aggregate-store/event-store/in-memory/in-memory.event-store";
import { CashFlowProjection } from "../../test/app/application/cashflow.projection";
import { Account } from "../../test/app/domain/account/account";
import { InMemoryCashflowStore } from "../../test/app/infrastructure/in-memory.cashflow.store";
import { eventuallyExpect } from "../../test/eventually-expect";
import { InMemoryCheckpoint } from "../checkpoint/in-memory.checkpoint";
import { InMemoryTransactionPerformer } from "../transaction/in-memory.transaction";
import { DistributedProjector } from "./distributed.projector";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Distributed implementation of Projector", () => {
  const es = new ESDBEventStore();
  const reader = new EsProjectedStreamReader(es);
  const persistor = new (EsAggregatePersistor.for(Account))(es);
  const store = new InMemoryCashflowStore();
  const projection = new CashFlowProjection(store);
  const checkpoint = new InMemoryCheckpoint();
  const transaction = new InMemoryTransactionPerformer();
  // const logger = new FakeLogger();

  // const press = makePress(() => es);

  const podA = new DistributedProjector(
    projection,
    reader,
    checkpoint,
    transaction
    // logger
  );
  const podB = new DistributedProjector(
    projection,
    reader,
    checkpoint,
    transaction
    // logger
  );

  beforeEach(() => {
    jest.spyOn(checkpoint, "set").mockRestore();

    store.clear();
    es.clear();
    checkpoint.clear();

    podA.start();
    podB.start();
  });

  afterEach(async () => {
    await podA.stop();
    await podB.stop();
  });

  it("should listen to the configured stream and feed the projection", async () => {
    const account = Account.new();
    account.deposit(100);
    await persistor.persist(account);

    await eventuallyExpect(async () => {
      const view = await store.load();
      expect(view.flow).toBe(100);
    });
  });

  it("should keep the read model consistent despite consumer delays", async () => {
    // First save happening between consumer will be delayed.
    // The consumer of the second event will persist the view first.
    jest
      .spyOn(store, "save")
      .mockImplementationOnce(async (view: any, trx: any) => {
        // console.log("waiting 50");
        await wait(50);
        // console.log("waited 50");
        return store.save(view, trx);
      });

    const accountA = Account.new();
    accountA.deposit(100);
    await persistor.persist(accountA); // will persist in 20ms
    await wait(10); // wait until the consumer of the first event has loaded the view in memory

    const accountB = Account.new();
    accountB.deposit(100);
    await persistor.persist(accountB); // will persist instantly using the second consumer
    await wait(200); // wait until the first consumer persists

    await eventuallyExpect(async () => {
      const view = await store.load();
      expect(view.flow).toBe(200);
    });
  });

  it("should retry to project until the event is successfully persisted", async () => {
    // First save will fail, but the retry's save will succeed
    jest
      .spyOn(store, "save")
      .mockRejectedValueOnce(new Error("infrastructure failed error"));

    const account = Account.new();
    account.deposit(100);
    await persistor.persist(account);

    await eventuallyExpect(async () => {
      const view = await store.load();
      expect(view.flow).toBe(100);
    });
  });

  it("should transactionally persist checkpoint and read models", async () => {
    // Projection will succeed but saving the new checkpoint will fail
    jest
      .spyOn(checkpoint, "set")
      .mockRejectedValue(new Error("cannot connect to the database"));

    const account = Account.new();
    account.deposit(100);
    await persistor.persist(account);

    // stop pod in 20ms to interrupt the infinite retry loop
    setTimeout(() => podA.stop(), 20);
    setTimeout(() => podB.stop(), 20);

    // wait for the pod to stop and transaction to rollback
    await wait(40);

    const pressCount = await store.load();
    expect(pressCount.flow).toBe(0);
  });
});
