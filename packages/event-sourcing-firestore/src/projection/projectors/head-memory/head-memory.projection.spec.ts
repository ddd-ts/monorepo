process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (process.env.DEBUG) {
  jest.setTimeout(100_000);
} else {
  jest.setTimeout(10_000);
}

import * as fb from "firebase-admin";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { FirestoreProjectedStreamReader } from "../../../firestore.projected-stream.reader";
import {
  Account,
  AccountOpened,
  BankId,
  Deposited,
  Withdrawn,
} from "../../write";
import { AccountStore, registry } from "../../registry";
import { AccountCashflowProjection } from "../../cashflow";
import { HeadMemoryProjector } from "./head-memory.projector";
import { HeadMemoryProjectionCheckpointStore } from "./head-memory.checkpoint-store";

describe("HeadMemoryProjection", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  function prepare() {
    const reader = new FirestoreProjectedStreamReader<
      AccountOpened | Deposited | Withdrawn
    >(firestore, registry);
    const accountStore = new AccountStore(firestore);
    const transaction = new FirestoreTransactionPerformer(firestore);
    const checkpointStore = new HeadMemoryProjectionCheckpointStore(firestore);
    const projection = new AccountCashflowProjection(
      transaction,
      checkpointStore as any,
    );

    const projector = new HeadMemoryProjector(
      projection,
      reader,
      checkpointStore as any,
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
      transaction,
    };
  }

  it("single event", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    projection.toggleSuspend(true);

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    const operation = projector.handle(opened);

    await projection.awaitSuspend(opened);
    projection.resume(opened);

    await operation;

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  });

  it("wait for AccountOpened to deposit", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();
    projection.toggleSuspend(true);
    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    const deposit = account.deposit(100);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    // projector.handle(opened);
    projector.handle(deposit);

    await projection.awaitSuspend(opened);
    await projection.tick();

    expect(projection.isSuspended(opened)).toBe(true);
    expect(projection.isSuspended(deposit)).toBe(false);
    projection.resume(opened);

    await projection.awaitSuspend(deposit);
    await projection.tick();

    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(true);
    projection.resume(deposit);

    await projection.tick();
    expect(projection.isSuspended(opened)).toBe(false);
    expect(projection.isSuspended(deposit)).toBe(false);

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 100,
    });
  });

  it("allows concurrency on deposits and withdrawals", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    projection.toggleSuspend(true);

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(withdraw);

    await projection.awaitSuspend(opened);
    await projection.tick();
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

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 150,
    });
  });

  it("allows batching Renamed events", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();
    projection.toggleSuspend(true);
    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    await accountStore.save(account);

    const opening = projector.handle(opened);
    await projection.awaitSuspend(opened);
    projection.resume(opened);
    await projection.tick();
    await opening;

    account.rename("New Name A");
    account.rename("New Name B");
    account.rename("New Name C");
    const renamed1 = account.rename("New Name 1");
    await accountStore.save(account);

    projector.handle(renamed1);
    await projection.awaitSuspend(renamed1);

    account.rename("New Name H");
    account.rename("New Name I");
    account.rename("New Name J");
    const renamed2 = account.rename("New Name 2");
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    expect(await checkpointStore.countProcessing(checkpointId)).toBe(4);

    projector.handle(renamed2);
    await projection.tick();

    expect(projection.suspended.size).toBe(1);
    expect(projection.isSuspended(renamed1)).toBe(true);
    expect(projection.isSuspended(renamed2)).toBe(false);

    projection.resume(renamed1);
    await projection.awaitSuspend(renamed2);

    expect(await checkpointStore.countProcessing(checkpointId)).toBe(4);

    const cashflow1 = await projection.cashflowStore.load(account.id);
    expect(cashflow1).toEqual({
      id: account.id,
      flow: 0,
      name: "New Name 1",
      all_names: ["New Name 1"],
    });

    projection.resume(renamed2);
    await projection.tick();

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow2 = await projection.cashflowStore.load(account.id);
    expect(cashflow2).toEqual({
      id: account.id,
      flow: 0,
      name: "New Name 2",
      all_names: ["New Name 1", "New Name 2"],
    });
  });

  it("resists handling duplicate events", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();
    projection.toggleSuspend(true);
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

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 150,
    });
  });

  it("support hundreds of concurrent events", async () => {
    const { accountStore, projection, projector } = prepare();

    projection.toggleSuspend(false);

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);

    const deposits = [...Array(50).keys()].map((i) => account.deposit(i));

    await accountStore.save(account);

    await projector.handle(opened);

    const depositing = deposits.map((d) => projector.handle(d));

    await Promise.all(depositing);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: account.balance,
    });
  }, 40_000);

  it("retries processing events that fail", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    projection.toggleSuspend(true);

    const bankId = BankId.generate();

    const [account, opened] = Account.open(bankId);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(opened);

    await projection.awaitSuspend(opened);
    projection.fail(opened, new Error("first failure"));

    await projection.awaitSuspend(opened);
    projection.resume(opened);

    await projection.tick();

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  });

  it("considers a processing event as failed after the timeout", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    projection.toggleSuspend(true);

    const bankId = BankId.generate();
    const [account, opened] = Account.open(bankId);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(opened);

    await projection.awaitSuspend(opened);

    const second = await projection.awaitSuspend(opened);
    second.resume();

    await projection.tick();

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  });

  it("considers a processing event as failed after the timeout, even if it is not flagged as failed explictly", async () => {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    projection.toggleSuspend(true);

    const bankId = BankId.generate();
    const [account, opened] = Account.open(bankId);
    const deposited = account.deposit(100);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(deposited);
    await projection.awaitSuspend(opened);
    projection.resume(opened);

    const first = await projection.awaitSuspend(deposited);
    const second = await projection.awaitSuspend(deposited);

    second.resume();
    await projection.tick();

    first.resume();
    await projection.tick();

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 100,
    });
  });

  /**
   * TODO:
   * - ensure that events can only be flagged as processing once
   * - ensure that events can only be flagged as done once
   * - ensure that the same event published twice wont cause issues
   *
   *
   */
});
