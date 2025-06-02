process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (process.env.DEBUG) {
  jest.setTimeout(100_000);
} else {
  jest.setTimeout(10_000);
}

import * as fb from "firebase-admin";
import { ProjectionCheckpointStore } from "./checkpoint";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { FirestoreProjectedStreamReader } from "../firestore.projected-stream.reader";
import { Account, AccountOpened, BankId, Deposited, Withdrawn } from "./write";
import { AccountStore, registry } from "./registry";
import { AccountCashflowProjection } from "./cashflow";
import { Projector } from "./projector";

describe("Projection", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  function prepare() {
    const reader = new FirestoreProjectedStreamReader<
      AccountOpened | Deposited | Withdrawn
    >(firestore, registry);
    const accountStore = new AccountStore(firestore);
    const projection = new AccountCashflowProjection();
    const checkpointStore = new ProjectionCheckpointStore(firestore);
    const transaction = new FirestoreTransactionPerformer(firestore);

    const projector = new Projector(
      projection,
      reader,
      checkpointStore,
      transaction,
    );

    return {
      app,
      firestore,
      reader,
      accountStore,
      projection,
      checkpointStore,
      projector,
    };
  }

  it("single event", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(opened);

    await projection.awaitSuspend(opened);
    projection.resume(opened);

    await projection.tick();

    const stateAfter = await checkpointStore.load(checkpointId);

    stateAfter?.thread.clean();
    expect(stateAfter?.thread.tasks).toHaveLength(0);
    expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);

    expect(projection.state[account.id.serialize()]).toEqual(0);
  });

  it("wait for AccountOpened to deposit", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    const deposit = account.deposit(100);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(deposit);

    await projection.awaitSuspend(opened);
    expect(projection.isSuspended(opened)).toBe(true);
    expect(projection.isSuspended(deposit)).toBe(false);
    projection.resume(opened);

    await projection.awaitSuspend(deposit);
    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(true);
    projection.resume(deposit);

    await projection.tick();
    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(false);

    expect(projection.state[account.id.serialize()]).toEqual(100);

    const stateAfter = await checkpointStore.load(checkpointId);

    stateAfter?.thread.clean();
    expect(stateAfter?.thread.tasks).toHaveLength(0);
    expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);
  });

  it("allows concurrency on deposits and withdrawals", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(withdraw);

    await projection.awaitSuspend(opened);
    expect(projection.isSuspended(opened)).toBe(true);
    expect(projection.isSuspended(deposit)).toBe(false);
    expect(projection.isSuspended(withdraw)).toBe(false);
    projection.resume(opened);
    await projection.tick();

    await Promise.all([
      projection.awaitSuspend(deposit),
      projection.awaitSuspend(withdraw),
    ]);
    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(true);
    expect(projection.isSuspended(withdraw)).toBe(true);
    projection.resume(deposit);
    projection.resume(withdraw);
    await projection.tick();

    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(false);

    expect(projection.state[account.id.serialize()]).toEqual(150);

    const stateAfter = await checkpointStore.load(checkpointId);

    stateAfter?.thread.clean();
    expect(stateAfter?.thread.tasks).toHaveLength(0);
    expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);
  });

  it("resists handling duplicate events", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(withdraw);
    projector.handle(withdraw);

    await projection.awaitSuspend(opened);
    expect(projection.isSuspended(opened)).toBe(true);
    expect(projection.isSuspended(deposit)).toBe(false);
    expect(projection.isSuspended(withdraw)).toBe(false);
    projection.resume(opened);
    await projection.tick();

    await Promise.all([
      projection.awaitSuspend(deposit),
      projection.awaitSuspend(withdraw),
    ]);
    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(true);
    expect(projection.isSuspended(withdraw)).toBe(true);
    projection.resume(deposit);
    projection.resume(withdraw);
    await projection.tick();

    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(false);

    expect(projection.state[account.id.serialize()]).toEqual(150);

    const stateAfter = await checkpointStore.load(checkpointId);

    stateAfter?.thread.clean();
    expect(stateAfter?.thread.tasks).toHaveLength(0);
    expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);
  });

  /**
   * TODO:
   * - ensure that events can only be flagged as processing once
   * - ensure that events can only be flagged as done once
   * - ensure that the same event published twice wont cause issues
   *
   *
   */

  // it("works2", async () => {
  //   const app = fb.initializeApp({ projectId: "demo-es" });
  //   const firestore = app.firestore();

  //   const eventBus = new QueuedSequentialInMemoryEventBus();

  //   const reader = new FirestoreProjectedStreamReader<
  //     AccountOpened | Deposited | Withdrawn
  //   >(firestore, registry);
  //   const accountStore = new AccountStore(firestore, eventBus);

  //   const projection = new AccountCashflowProjection();

  //   const projectionStateStore = new ProjectionStateStore(
  //     firestore.collection("projection"),
  //     new ProjectionStateSerializer(),
  //   );

  //   const projector = new Projector(
  //     projection,
  //     reader,
  //     projectionStateStore,
  //     new FirestoreTransactionPerformer(firestore),
  //   );

  //   eventBus.on(AccountOpened, (event) => projector.handle(event));
  //   eventBus.on(Deposited, (event) => projector.handle(event));
  //   eventBus.on(Withdrawn, (event) => projector.handle(event));

  //   const bankId = BankId.generate();

  //   const [account, opened] = Account.open(bankId);
  //   const deposit = account.deposit(100);
  //   await accountStore.save(account);

  //   const flushing = eventBus.flushQueueParallel();

  //   await projection.awaitSuspend(opened);
  //   projection.resume(opened);

  //   await projection.awaitSuspend(deposit);
  //   projection.resume(deposit);

  //   await flushing;

  //   expect(projection.state).toEqual({});
  // });
});
