import { EsAggregatePersistor } from "../../es-aggregate-store/es-aggregate.persistor";
import { EsProjectedStreamReader } from "../../es-aggregate-store/es-projected-stream.reader";
import { InMemoryEventStore } from "../../es-aggregate-store/event-store/in-memory/in-memory.event-store";
import { CashFlowProjection } from "../../test/app/application/cashflow.projection";
import { Account } from "../../test/app/domain/account/account";
import { InMemoryCashflowStore } from "../../test/app/infrastructure/in-memory.cashflow.store";
import { eventuallyExpect } from "../../test/eventually-expect";
import { InMemoryCheckpoint } from "../checkpoint/in-memory.checkpoint";
import { InMemoryTransactionPerformer } from "../transaction/in-memory.transaction";
import { IsolatedProjector } from "./isolated.projector";

describe("Isolated implementation of projector", () => {
  const es = new InMemoryEventStore();
  const persistor = new (EsAggregatePersistor(Account))(es);
  const reader = new EsProjectedStreamReader(es);

  const transaction = new InMemoryTransactionPerformer();
  // const logger = new FakeLogger();

  const storeA = new InMemoryCashflowStore();
  const podA = new IsolatedProjector(
    new CashFlowProjection(storeA),
    reader,
    new InMemoryCheckpoint(),
    transaction
    // logger
  );

  const storeB = new InMemoryCashflowStore();
  const podB = new IsolatedProjector(
    new CashFlowProjection(storeB),
    reader,
    new InMemoryCheckpoint(),
    transaction
    // logger
  );

  beforeEach(() => {
    podA.start();
    podB.start();
  });

  afterEach(async () => {
    await podA.stop();
    await podB.stop();
  });

  it("should maintain projection in each isolated consumer", async () => {
    const account = Account.new();

    account.deposit(100);
    account.deposit(200);

    await persistor.persist(account);

    await eventuallyExpect(async () => {
      expect((await storeA.load()).flow).toBe(300);
      expect((await storeB.load()).flow).toBe(300);
    });
  });
});
