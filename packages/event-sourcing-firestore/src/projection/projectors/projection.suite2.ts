process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (process.env.DEBUG) {
  jest.setTimeout(100_000);
} else {
  jest.setTimeout(10_000);
}

import { Account, BankId } from "../write";
import { AccountStore } from "../registry";
import { AccountCashflowProjection2 } from "../cashflow2";
import { Projector } from "../projector";

export function ProjectorSuite2(
  prepare: () => {
    accountStore: AccountStore;
    projection: AccountCashflowProjection2;
    checkpointStore: any;
    projector: Projector;
  },
) {
  async function SingleEvent() {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate(SingleEvent);

    const [account, opened] = Account.open(bankId, SingleEvent);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    const operation = projector.handle(opened);
    await projection.handlers.AccountOpened.suspend(opened);
    projection.handlers.AccountOpened.resume(opened);

    await operation;

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  }

  async function SimpleLocking() {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate(SimpleLocking);

    const [account, opened] = Account.open(bankId, SimpleLocking);
    const deposit = account.deposit(100);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    const operation = projector.handle(deposit);
    await projection.suspend(opened);

    expect(projection.print(SimpleLocking)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() before
"
`);

    projection.resume(opened);
    await projection.suspend(deposit);

    expect(projection.print(SimpleLocking)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) before
"
`);

    projection.resume(deposit);
    await operation;

    expect(projection.print(SimpleLocking)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) after
"
`);

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 100,
    });
  }

  async function SimpleConcurrency() {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate(SimpleConcurrency);
    const [account, opened] = Account.open(bankId, SimpleConcurrency);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(withdraw);
    await projection.suspend(opened);
    await projection.tick();

    expect(projection.print(SimpleConcurrency)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() before
"
`);

    projection.resume(opened);

    await Promise.all([
      projection.suspend(deposit),
      projection.suspend(withdraw),
    ]);

    await projection.tick();

    expect(projection.print(SimpleConcurrency)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) before
Withdrawn: 
	Account<A-1>:Withdrawn(50) before
"
`);

    projection.resume(deposit);
    projection.resume(withdraw);
    await projection.tick();

    expect(projection.print(SimpleConcurrency)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) after
Withdrawn: 
	Account<A-1>:Withdrawn(50) after
"
`);

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 150,
    });
  }

  async function SimpleBatching() {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate(SimpleBatching);

    const [account, opened] = Account.open(bankId, SimpleBatching);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    await projector.handle(opened);

    account.rename("New Name A");
    account.rename("New Name B");
    account.rename("New Name C");
    const renamed1 = account.rename("New Name 1");
    await accountStore.save(account);

    projector.handle(renamed1);
    await projection.suspend(renamed1);

    expect(projection.print(SimpleBatching)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
AccountRenamed: 
	Account<A-1>:Renamed(New Name A) before
	Account<A-1>:Renamed(New Name B) before
	Account<A-1>:Renamed(New Name C) before
	Account<A-1>:Renamed(New Name 1) before
"
`);

    account.rename("New Name H");
    account.rename("New Name I");
    account.rename("New Name J");
    const renamed2 = account.rename("New Name 2");
    await accountStore.save(account);

    projector.handle(renamed2);
    await projection.tick();

    expect(projection.print(SimpleBatching)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
AccountRenamed: 
	Account<A-1>:Renamed(New Name A) before
	Account<A-1>:Renamed(New Name B) before
	Account<A-1>:Renamed(New Name C) before
	Account<A-1>:Renamed(New Name 1) before
"
`);

    projection.resume(renamed1);
    await projection.suspend(renamed2);

    expect(projection.print(SimpleBatching)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
AccountRenamed: 
	Account<A-1>:Renamed(New Name A) after
	Account<A-1>:Renamed(New Name B) after
	Account<A-1>:Renamed(New Name C) after
	Account<A-1>:Renamed(New Name 1) after
	Account<A-1>:Renamed(New Name H) before
	Account<A-1>:Renamed(New Name I) before
	Account<A-1>:Renamed(New Name J) before
	Account<A-1>:Renamed(New Name 2) before
"
`);

    const cashflow1 = await projection.cashflowStore.load(account.id);
    expect(cashflow1).toEqual({
      id: account.id,
      flow: 0,
      name: "New Name 1",
      all_names: ["New Name 1"],
    });

    projection.resume(renamed2);
    await projection.tick();

    expect(projection.print(SimpleBatching)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
AccountRenamed: 
	Account<A-1>:Renamed(New Name A) after
	Account<A-1>:Renamed(New Name B) after
	Account<A-1>:Renamed(New Name C) after
	Account<A-1>:Renamed(New Name 1) after
	Account<A-1>:Renamed(New Name H) after
	Account<A-1>:Renamed(New Name I) after
	Account<A-1>:Renamed(New Name J) after
	Account<A-1>:Renamed(New Name 2) after
"
`);

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow2 = await projection.cashflowStore.load(account.id);
    expect(cashflow2).toEqual({
      id: account.id,
      flow: 0,
      name: "New Name 2",
      all_names: ["New Name 1", "New Name 2"],
    });
  }

  async function DuplicateHandling() {
    const { accountStore, projection, checkpointStore, projector } = prepare();

    const bankId = BankId.generate(DuplicateHandling);

    const [account, opened] = Account.open(bankId, DuplicateHandling);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    const checkpointId = projection.getShardCheckpointId(opened);

    projector.handle(withdraw);
    projector.handle(withdraw);

    await projection.suspend(opened);
    await projection.tick();

    expect(projection.print(DuplicateHandling)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() before
"
`);

    projection.resume(opened);
    await Promise.all([
      projection.suspend(deposit),
      projection.suspend(withdraw),
    ]);

    expect(projection.print(DuplicateHandling)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) before
Withdrawn: 
	Account<A-1>:Withdrawn(50) before
"
`);

    projection.resume(deposit);
    projection.resume(withdraw);
    await projection.tick();

    expect(projection.print(DuplicateHandling)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) after
Withdrawn: 
	Account<A-1>:Withdrawn(50) after
"
`);

    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    const cashflow = await projection.cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 150,
    });
  }

  async function HeavyHandleConcurrency() {
    const { accountStore, projection, projector, checkpointStore } = prepare();

    const bankId = BankId.generate(HeavyHandleConcurrency);

    const [account, opened] = Account.open(bankId, HeavyHandleConcurrency);

    const deposits = [...Array(50).keys()].map((i) => account.deposit(i));
    await accountStore.save(account);

    await projector.handle(opened);
    const depositing = deposits.map((d) => projector.handle(d));
    await Promise.all(depositing);

    const deposits2 = [...Array(50).keys()].map((i) => account.deposit(i + 50));
    await accountStore.save(account);

    const depositing2 = deposits2.map((d) => projector.handle(d));
    await Promise.all(depositing2);

    const cashflow = await projection.cashflowStore.load(account.id);

    const checkpointId = projection.getShardCheckpointId(opened);
    expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: account.balance,
    });
  }

  // async function ExplicitFailureRetry() {
  //   const { accountStore, projection, checkpointStore, projector } = prepare();

  //   projection.toggleSuspend(true);

  //   const bankId = BankId.generate();

  //   const [account, opened] = Account.open(bankId);
  //   await accountStore.save(account);

  //   const checkpointId = projection.getShardCheckpointId(opened);

  //   projector.handle(opened);

  //   await projection.awaitSuspend(opened);
  //   projection.fail(opened, new Error("first failure"));

  //   await projection.awaitSuspend(opened);
  //   projection.resume(opened);

  //   await projection.tick();

  //   expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

  //   const cashflow = await projection.cashflowStore.load(account.id);
  //   expect(cashflow).toMatchObject({
  //     id: account.id,
  //     flow: 0,
  //   });
  // }

  // async function ImplicitTimeoutFailureRetry() {
  //   const { accountStore, projection, checkpointStore, projector } = prepare();

  //   projection.toggleSuspend(true);

  //   const bankId = BankId.generate();
  //   const [account, opened] = Account.open(bankId);
  //   await accountStore.save(account);

  //   const checkpointId = projection.getShardCheckpointId(opened);

  //   projector.handle(opened);

  //   await projection.awaitSuspend(opened);

  //   const second = await projection.awaitSuspend(opened);
  //   second.resume();

  //   await projection.tick();

  //   expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

  //   const cashflow = await projection.cashflowStore.load(account.id);
  //   expect(cashflow).toMatchObject({
  //     id: account.id,
  //     flow: 0,
  //   });
  // }

  //   it("considers a processing event as failed after the timeout, even if it is not flagged as failed explictly", async () => {
  //   const { accountStore, projection, checkpointStore, projector } = prepare();

  //   projection.toggleSuspend(true);

  //   const bankId = BankId.generate();
  //   const [account, opened] = Account.open(bankId);
  //   const deposited = account.deposit(100);
  //   await accountStore.save(account);

  //   const checkpointId = projection.getShardCheckpointId(opened);

  //   projector.handle(deposited);
  //   await projection.awaitSuspend(opened);
  //   projection.resume(opened);

  //   const first = await projection.awaitSuspend(deposited);
  //   const second = await projection.awaitSuspend(deposited);

  //   second.resume();
  //   await projection.tick();

  //   first.resume();
  //   await projection.tick();

  //   expect(await checkpointStore.isFinished(checkpointId)).toBe(true);

  //   const cashflow = await projection.cashflowStore.load(account.id);
  //   expect(cashflow).toMatchObject({
  //     id: account.id,
  //     flow: 100,
  //   });
  // });

  /**
   * TODO:
   * - ensure that events can only be flagged as processing once
   * - ensure that events can only be flagged as done once
   * - ensure that the same event published twice wont cause issues
   *
   *
   */

  return {
    SingleEvent,
    SimpleLocking,
    SimpleConcurrency,
    SimpleBatching,
    DuplicateHandling,
    HeavyHandleConcurrency,
    // ExplicitFailureRetry,
    // ImplicitTimeoutFailureRetry,
  };
}
