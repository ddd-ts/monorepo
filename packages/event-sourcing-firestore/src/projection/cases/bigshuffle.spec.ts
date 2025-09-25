import { caseFixture, locks, traits } from "../testkit/case-fixture";

jest.setTimeout(20_000);

const test = caseFixture("BigShuffle", {
  handlers: {
    AccountOpened: {
      chain: [traits.Context(), traits.Transaction(), traits.Parallel()],
      lock: locks.wholeAccount,
    },
    Deposited: {
      chain: [traits.Context(), traits.Parallel(), traits.Transaction()],
      lock: locks.accountAndEventId, // allows parallel deposits
    },
    Withdrawn: {
      chain: [traits.Context(), traits.Parallel(), traits.Transaction()],
      lock: locks.accountAndEventId, // allows parallel withdrawals
    },=
  },
});

test.describe(() => {
  it("processes mixed events under load and matches expectations", async () => {
    const { events, act, cashflowStore } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    // Generate 50 deposits of random amounts between 1 and 1000
    const deposits = [...Array(50).keys()].map(() => {
      const amount = Math.floor(Math.random() * 1000) + 1;
      return account.deposit(amount);
    });

    // Generate 50 withdrawals of random amounts between 1 and 100
    const withdrawals = [...Array(50).keys()].map(() => {
      const amount = Math.floor(Math.random() * 100) + 1;
      return account.withdraw(amount);
    });

    await act.save(account);

    // Generate 20 renames to simulate non-cashflow events
    const renames = [...Array(20).keys()].map((i) =>
      account.rename(`StressTestName_${i.toString().padStart(3, "0")}`),
    );
    await act.save(account);

    // Shuffle and handle all events in batches to simulate concurrency
    const eventsAll = [...deposits, ...withdrawals, ...renames].sort(
      () => Math.random() - 0.5,
    );
    const batchSize = 25;
    const batches: any[][] = [];
    for (let i = 0; i < eventsAll.length; i += batchSize) {
      batches.push(eventsAll.slice(i, i + batchSize));
    }

    // Process batches sequentially, but events within each batch concurrently
    await Promise.all(
      batches.map((batch) => Promise.all(batch.map((e) => act.handle(e)))),
    );

    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toBeDefined();

    // Calculate expected flow based on deposits and withdrawals
    const expectedFlow =
      deposits.reduce((s, d: any) => s + d.payload.amount, 0) +
      withdrawals.reduce((s, w: any) => s + w.payload.amount, 0);

    expect(cashflow!.flow).toBe(expectedFlow);
    expect(cashflow!.name).toBe("StressTestName_019");
  });
});
