import { CashflowProjection } from "./cashflow/cashflow.projection";
import {
  Account,
  AccountId,
  AccountOpened,
  AccountRenamed,
  Deposited,
  Withdrawn,
} from "./account/account";
import { Projector } from "../projector";
import { SerializerRegistry } from "../../components/serializer-registry";
import { EventStreamAggregateStore } from "../../components/event-stream.aggregate-store";
import { CashflowSerializer, CashflowStore } from "./cashflow/cashflow.store";
import { Cashflow } from "./cashflow/cashflow";

const Registry = new SerializerRegistry()
  .auto(AccountOpened)
  .auto(Deposited)
  .auto(Withdrawn)
  .auto(AccountRenamed)
  .auto(Account);

function ProjectorSuite(
  makePrepare: (registry: typeof Registry) => () => {
    accountStore: EventStreamAggregateStore<Account>;
    cashflowStore: CashflowStore;
    projection: CashflowProjection;
    projector: Projector;
    disableUnclaimOnFailure(): void;
  },
) {
  const prepare = makePrepare(Registry);

  async function SingleEvent() {
    const n = "SingleEvent";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);

    await accountStore.save(account);

    const operation = projector.handle(opened);

    await projection.suspend(opened);

    projection.resume(opened);

    await operation;

    const cashflow = await cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  }

  async function SimpleLocking() {
    const n = "SimpleLocking";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    const deposit = account.deposit(100);
    await accountStore.save(account);

    const operation = projector.handle(deposit);
    await projection.suspend(opened);

    expect(projection.print(n)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() before
"
`);

    projection.resume(opened);
    await projection.suspend(deposit);

    expect(projection.print(n)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) before
"
`);

    projection.resume(deposit);
    await operation;

    expect(projection.print(n)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) after
"
`);

    const cashflow = await cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 100,
    });
  }

  async function SimpleConcurrency() {
    const n = "SimpleConcurrency";
    const { accountStore, projection, projector, cashflowStore } = prepare();
    const [account, opened] = Account.open(n);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    projector.handle(withdraw);
    await projection.suspend(opened);
    await projection.tick();

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    expect(projection.print(n)).toMatchInlineSnapshot(`
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
    await projection.tick();
    await projection.tick();

    expect(projection.print(n)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) after
Withdrawn: 
	Account<A-1>:Withdrawn(50) after
"
`);
  }

  async function SimpleBatching() {
    const n = "SimpleBatching";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    await projector.handle(opened);

    account.rename("New Name A");
    account.rename("New Name B");
    account.rename("New Name C");
    const renamed1 = account.rename("New Name 1");
    await accountStore.save(account);

    projector.handle(renamed1);
    await projection.suspend(renamed1);

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    const cashflow1 = await cashflowStore.load(account.id);
    expect(cashflow1).toEqual({
      id: account.id,
      flow: 0,
      name: "New Name 1",
      all_names: ["New Name 1"],
    });

    projection.resume(renamed2);
    await projection.tick();

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    const cashflow2 = await cashflowStore.load(account.id);
    expect(cashflow2).toEqual({
      id: account.id,
      flow: 0,
      name: "New Name 2",
      all_names: ["New Name 1", "New Name 2"],
    });
  }

  async function DuplicateHandling() {
    const n = "DuplicateHandling";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await accountStore.save(account);

    projector.handle(withdraw);
    projector.handle(withdraw);

    await projection.suspend(opened);
    await projection.tick();

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    expect(projection.print(n)).toMatchInlineSnapshot(`
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

    expect(projection.print(n)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
Deposited: 
	Account<A-1>:Deposited(100) after
Withdrawn: 
	Account<A-1>:Withdrawn(50) after
"
`);

    await projection.tick();
    await projection.tick();
    await projection.tick();
    await projection.tick();

    const cashflow = await cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 150,
    });
  }

  async function HeavyHandleConcurrency() {
    const n = "HeavyHandleConcurrency";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);

    const deposits = [...Array(50).keys()].map((i) => account.deposit(i));
    await accountStore.save(account);

    await projector.handle(opened);
    const depositing = deposits.map((d) => projector.handle(d));
    await Promise.all(depositing);

    const deposits2 = [...Array(50).keys()].map((i) => account.deposit(i + 50));
    await accountStore.save(account);

    const depositing2 = deposits2.map((d) => projector.handle(d));
    await Promise.all(depositing2);

    const cashflow = await cashflowStore.load(account.id);

    expect(cashflow).toMatchObject({
      id: account.id,
      flow: account.balance,
    });
  }

  async function TemporalLockRestraint() {
    const n = "TemporalLockRestraint";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    // Process account opening first
    await projector.handle(opened);

    // Create multiple rename events in sequence
    account.rename("First Name");
    account.rename("Second Name");
    const finalRename = account.rename("Final Name");
    await accountStore.save(account);

    // Handle the final rename event, which should trigger processing of all pending renames
    await projector.handle(finalRename);

    // Verify that only the final rename is applied (temporal lock behavior)
    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toEqual({
      id: account.id,
      flow: 0,
      name: "Final Name",
      all_names: ["Final Name"], // Only the last rename should be processed due to BatchLast
    });

    // Verify that all rename events were processed but only the last one took effect
    expect(projection.print(n)).toMatchInlineSnapshot(`
"
AccountOpened: 
	Account<A-1>:Opened() after
AccountRenamed: 
	Account<A-1>:Renamed(First Name) after
	Account<A-1>:Renamed(Second Name) after
	Account<A-1>:Renamed(Final Name) after
"
`);
  }

  async function TemporalLockConcurrencyRestraint() {
    const n = "TemporalLockConcurrencyRestraint";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    // Process account opening first
    await projector.handle(opened);

    // Create multiple rename events with different locks that should restrain each other
    account.rename("Rename Alpha");
    account.rename("Rename Beta");
    account.rename("Rename Gamma");
    const finalRename = account.rename("Final Rename");

    // Also add some deposits that should NOT be restrained by renames
    const deposit1 = account.deposit(100);
    const deposit2 = account.deposit(200);

    await accountStore.save(account);

    // Handle events concurrently to test lock restraint behavior
    await Promise.all([
      projector.handle(finalRename),
      projector.handle(deposit1),
      projector.handle(deposit2),
    ]);

    // Verify final state:
    // - Only the final rename should be applied (temporal lock restraint)
    // - All deposits should be applied (no restraint between deposits)
    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toEqual({
      id: account.id,
      flow: 300, // Both deposits should be processed
      name: "Final Rename", // Only the last rename should take effect
      all_names: ["Final Rename"], // BatchLast behavior for renames
    });

    // Verify that the lock system correctly batched restraining events
    const output = projection.print(n);
    expect(output).toContain("Final Rename");
    expect(output).toContain("Deposited(100)");
    expect(output).toContain("Deposited(200)");
  }

  async function ComprehensiveVolumeStressTest() {
    const n = "ComprehensiveVolumeStressTest";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    // Process account opening first
    await projector.handle(opened);

    // Generate hundreds of mixed events to stress-test all implementations
    const events: any[] = [];

    // Create 300 deposits with varying amounts
    const deposits = [...Array(100).keys()].map((i) => {
      const amount = Math.floor(Math.random() * 1000) + 1; // 1-1000
      return account.deposit(amount);
    });
    events.push(...deposits);

    // Create 200 withdrawals with smaller amounts to avoid negative balance
    const withdrawals = [...Array(100).keys()].map((i) => {
      const amount = Math.floor(Math.random() * 100) + 1; // 1-100 to keep balance positive
      return account.withdraw(amount);
    });
    events.push(...withdrawals);

    await accountStore.save(account);

    // Create 50 rename events to test temporal lock behavior under load
    const renames = [...Array(50).keys()].map((i) => {
      return account.rename(`StressTestName_${i.toString().padStart(3, "0")}`);
    });
    events.push(...renames);

    await accountStore.save(account);

    // Shuffle events to create realistic concurrent processing scenario
    const shuffledEvents = [...events].sort(() => Math.random() - 0.5);

    // Process events in batches to simulate realistic load patterns
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < shuffledEvents.length; i += batchSize) {
      batches.push(shuffledEvents.slice(i, i + batchSize));
    }

    // Process all batches concurrently to maximize stress
    const batchPromises = batches.map((batch) =>
      Promise.all(batch.map((event) => projector.handle(event))),
    );
    await Promise.all(batchPromises);

    // Verify final state
    const cashflow = await cashflowStore.load(account.id);

    // Ensure cashflow was created
    expect(cashflow).toBeDefined();

    const expectedCashflow =
      deposits.reduce((sum, d) => sum + d.payload.amount, 0) +
      withdrawals.reduce((sum, w) => sum + w.payload.amount, 0);

    // The final balance should match our expected calculation
    expect(cashflow!.flow).toBe(expectedCashflow);

    // Due to BatchLast behavior, only the final rename should take effect
    const expectedFinalName = "StressTestName_049"; // Last rename event
    expect(cashflow!.name).toBe(expectedFinalName);
    if (cashflow!.all_names) {
      // expect(cashflow!.all_names).toEqual([expectedFinalName]);
    }

    // Log performance metrics
    console.log(
      `processed ${events.length} events (${deposits.length} deposits, ${withdrawals.length} withdrawals, ${renames.length} renames)`,
    );
    console.log(
      `final cashflow: ${cashflow!.flow}, expected: ${expectedCashflow}`,
    );
    console.log(`final name: ${cashflow!.name}`);

    const expectedBalance =
      deposits.reduce((sum, d) => sum + d.payload.amount, 0) -
      withdrawals.reduce((sum, w) => sum + w.payload.amount, 0);

    // Verify the account's internal state matches our expectations
    expect(account.balance).toBe(expectedBalance);
    expect(account.name).toBe(expectedFinalName);
  }

  async function RealisticAccountWorkflowStressTest() {
    const stressload = 150; // Number of operations to simulate
    const n = "RealisticAccountWorkflowStressTest";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    // Process account opening first
    await projector.handle(opened);

    // Seeded random number generator for deterministic results
    class SeededRandom {
      private seed: number;
      constructor(seed: number) {
        this.seed = seed;
      }
      next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
      }
    }

    const rng = new SeededRandom(12345); // Fixed seed for reproducible results
    const events: any[] = [];
    let expectedCashflow = 0;
    let renameCount = 0;
    let depositCount = 0;
    let withdrawalCount = 0;

    // Generate 300 realistic account operations
    for (let i = 0; i < stressload; i++) {
      const rand = rng.next();

      if (rand < 0.6) {
        // 60% chance of deposit (most common operation)
        const amount = Math.floor(rng.next() * 500) + 10; // 10-509
        expectedCashflow += amount;
        events.push(account.deposit(amount));
        depositCount++;
      } else if (rand < 0.85 && expectedCashflow > 50) {
        // 25% chance of withdrawal (only if sufficient balance)
        const maxWithdraw = Math.min(expectedCashflow - 10, 200); // Leave some balance, max 200
        const amount = Math.floor(rng.next() * maxWithdraw) + 1;
        expectedCashflow += amount;
        events.push(account.withdraw(amount));
        withdrawalCount++;
      } else {
        // 15% chance of rename (or fallback if withdrawal not possible)
        const nameId = renameCount.toString().padStart(3, "0");
        events.push(account.rename(`WorkflowName_${nameId}`));
        renameCount++;
      }

      // Save account state periodically to simulate realistic database operations
      if (i % 50 === 49) {
        await accountStore.save(account);
      }
    }

    // Final save
    await accountStore.save(account);

    // Process all events concurrently to stress test the implementations
    const eventPromises = events.map((event) => projector.handle(event));
    await Promise.all(eventPromises);

    // Verify final state
    const cashflow = await cashflowStore.load(account.id);

    // Ensure cashflow was created
    expect(cashflow).toBeDefined();

    // The final balance should match our expected calculation
    expect(cashflow!.flow).toBe(expectedCashflow);
    // expect(cashflow!.id).toBe(account.id.serialize());

    // Due to BatchLast behavior, only the final rename should take effect
    const expectedFinalName = `WorkflowName_${(renameCount - 1)
      .toString()
      .padStart(3, "0")}`;
    expect(cashflow!.name).toBe(expectedFinalName);
    // if (cashflow!.all_names) {
    //   expect(cashflow!.all_names).toEqual([expectedFinalName]);
    // }

    // Log performance metrics and operation distributio

    // Verify the account's internal state matches our expectations
    // expect(account.balance).toBe(expectedBalance);
    expect(account.name).toBe(expectedFinalName);
  }

  async function ExplicitFailureRetry() {
    const n = "ExplicitFailureRetry";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    projector.handle(opened);

    await projection.suspend(opened);
    projection.fail(opened, new Error("first failure"));

    await projection.suspend(opened);
    projection.resume(opened);

    await projection.tick();

    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  }

  async function ExplicitTimeoutFailureRetry() {
    const n = "ExplicitTimeoutFailureRetry";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    projector.handle(opened);

    await projection.suspend(opened);
    const second = await projection.suspend(opened);
    second.resume();

    await projection.tick();

    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 0,
    });
  }

  async function ImplicitFailureRetry() {
    const n = "ImplicitTimeoutFailureRetry";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    const operation = projector.handle(opened);

    const first = await projection.suspend(opened);
    first.fail();

    const second = await projection.suspend(opened);
    second.fail();

    const third = await projection.suspend(opened);
    third.fail();

    // const fourth = await projection.suspend(opened);
    // fourth.fail();

    try {
      await operation;
    } catch (error) {
      // Expect an error due to implicit timeout failure
      console.log(
        `ImplicitTimeoutFailureRetry: Caught expected error: ${error}`,
      );
    }

    // We are now in a state where the event was queued,
    // but the operation didnt succeed.
    // the event wasnt processed, but it is still in the queue.
    // We want to ensure that we have a way to recover from this state.

    // Having a followup event should trigger the previous event to be processed beforehand.

    const followup = account.deposit(100);
    await accountStore.save(account);

    const operation2 = projector.handle(followup);
    await operation2;

    await projection.tick();

    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toMatchObject({
      id: account.id,
      flow: 100,
    });
  }

  async function ImplicitTimeoutFailureSkip() {
    const n = "ImplicitTimeoutFailureSkip";
    const { accountStore, projection, projector, cashflowStore } = prepare();

    const getFlow = async (accountId: AccountId) => {
      const cashflow = await cashflowStore.load(accountId);
      return cashflow ? cashflow.flow : 0;
    };

    // First, we handle the account opening event
    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    await projector.handle(opened);

    const failing = account.deposit(1000);
    projection.testhandlers.Deposited.markFailing(failing);
    await accountStore.save(account);

    const first = projector.handle(failing);

    expect(await first.catch((e) => e)).toBeInstanceOf(Error);
    expect(await getFlow(account.id)).toEqual(0);

    const deposited = account.deposit(100);
    await accountStore.save(account);

    const second = projector.handle(deposited);
    await second.catch((e) => e);

    const deposited2 = account.deposit(100);
    await accountStore.save(account);

    const third = projector.handle(deposited2);
    await third.catch((e) => e);

    // Then, we withdraw 50, but the failing event still fails to process
    // We should now hit the failure threshold for the failing event
    const withdrawn = account.withdraw(50);
    await accountStore.save(account);

    const fourth = projector.handle(withdrawn);

    (await projection.suspend(withdrawn)).resume();

    await fourth;

    // We are now in a state where the event was queued,
    // but the operation didnt succeed.
    // the event wasnt processed, but it is still in the queue.
    // We want to ensure that we have a way to recover from this state.

    // Having a followup event should trigger the previous event to be processed beforehand.

    await projection.tick();

    expect(await getFlow(account.id)).toEqual(250);
  }

  async function ImplicitFailureSkip() {
    const n = "ImplicitFailureSkip";
    const {
      accountStore,
      projection,
      projector,
      cashflowStore,
      disableUnclaimOnFailure,
    } = prepare();

    disableUnclaimOnFailure();

    const getFlow = async (accountId: AccountId) => {
      const cashflow = await cashflowStore.load(accountId);
      return cashflow ? cashflow.flow : 0;
    };

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    await projector.handle(opened);

    const failing = account.deposit(1000);
    projection.testhandlers.Deposited.markFailing(failing);
    await accountStore.save(account);
    const first = projector.handle(failing);
    expect(await first.catch((e) => e)).toBeInstanceOf(Error);

    expect(await getFlow(account.id)).toEqual(0);

    const deposited = account.deposit(100);
    await accountStore.save(account);
    await projector.handle(deposited);

    const withdrawn = account.withdraw(50);
    await accountStore.save(account);
    await projector.handle(withdrawn);

    await projection.tick();

    expect(await getFlow(account.id)).toEqual(150);
  }

  async function ImplicitTimeoutFailureRetry() {
    const n = "ImplicitTimeoutFailureRetry";
    const {
      accountStore,
      projection,
      projector,
      cashflowStore,
      disableUnclaimOnFailure,
    } = prepare();
    // Disable unclaiming to simulate a preemption

    disableUnclaimOnFailure();

    const getFlow = async (accountId: AccountId) => {
      const cashflow = await cashflowStore.load(accountId);
      return cashflow ? cashflow.flow : 0;
    };

    const [account, opened] = Account.open(n);
    await accountStore.save(account);

    await projector.handle(opened);

    const failing = account.deposit(1000);

    const unmarkFailing =
      projection.testhandlers.Deposited.markFailing(failing);

    await accountStore.save(account);
    const first = projector.handle(failing);
    expect(await first.catch((e) => e)).toBeInstanceOf(Error);

    expect(await getFlow(account.id)).toEqual(0);

    const deposited = account.deposit(100);
    await accountStore.save(account);
    await projector.handle(deposited);

    unmarkFailing();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const withdrawn = account.withdraw(50);
    await accountStore.save(account);
    await projector.handle(withdrawn);

    await projection.tick();
    await projection.tick();
    await projection.tick();

    expect(await getFlow(account.id)).toEqual(1150);
  }

  return {
    SingleEvent,
    SimpleLocking,
    SimpleConcurrency,
    SimpleBatching,
    DuplicateHandling,
    HeavyHandleConcurrency,
    TemporalLockRestraint,
    TemporalLockConcurrencyRestraint,
    ComprehensiveVolumeStressTest,
    RealisticAccountWorkflowStressTest,
    ExplicitFailureRetry,
    ExplicitTimeoutFailureRetry,
    ImplicitFailureRetry,
    ImplicitFailureSkip,
    ImplicitTimeoutFailureRetry,
    ImplicitTimeoutFailureSkip,
  };
}

export const ProjectorTesting = {
  Suite: ProjectorSuite,
  Registry,
  Account,
  CashflowProjection,
  AccountOpened,
  AccountRenamed,
  Deposited,
  Withdrawn,
  AccountId,
  Cashflow,
  CashflowSerializer,
};
