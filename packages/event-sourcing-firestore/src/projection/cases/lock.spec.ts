import { caseFixture, locks, traits } from "../testkit/case-fixture";

jest.setTimeout(60_000);

const test = caseFixture("Lock", {
  handlers: {
    AccountOpened: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.Delay(1000), // to ensure that deposit waits for it
        traits.Parallel(),
      ],
      lock: locks.wholeAccount,
    },
    Deposited: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.Parallel(),
      ],
      lock: locks.accountAndEventId, // allows parallel deposits
    },
    Withdrawn: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.Sequential(),
      ],
      lock: locks.wholeAccount, // forces sequential withdrawals
    },
  },
});

test.describe(() => {
  it("processes deposit after opened resumes", async () => {
    const { events, act, assert } = await test.setup();

    const [account] = events.open(test.name);
    const deposit = account.deposit(100);
    await act.save(account);

    await act.handle(deposit);

    await assert.cashflow(account.id).toHave({ id: account.id, flow: 100 });
  });

  it("processes deposits in parallel, but withdrawals sequentially", async () => {
    const { events, act, assert } = await test.setup();

    const [account, opened] = events.open(test.name);

    const deposits = new Map();
    while (deposits.size < 100) {
      const deposit = account.deposit(deposits.size);
      deposits.set(deposit.id.serialize(), deposit);
    }

    // await act.save(account);

    const withdrawals = new Map();
    while (withdrawals.size < 50) {
      const withdrawal = account.withdraw(withdrawals.size);
      withdrawals.set(withdrawal.id.serialize(), withdrawal);
    }

    const last = account.deposit(50);

    await act.save(account);
    await act.handle(last);

    const cashflow = await assert.fetch(account.id);

    const trace = cashflow?.ops_trace.map((id) => id.serialize());

    const report = trace?.map((id) =>
      id === opened.id.serialize()
        ? "O"
        : deposits.has(id)
          ? "D"
          : withdrawals.has(id)
            ? "W"
            : "L",
    );

    // For debugging:
    //    const report = trace.map((id) =>
    //   id === opened.id.serialize()
    //     ? "O"
    //     : deposits.has(id)
    //       ? `D ${deposits.get(id).payload.amount} ${id}`
    //       : withdrawals.has(id)
    //         ? `W ${withdrawals.get(id).payload.amount} ${id}`
    //         : "L",
    // );

    expect(report).toEqual([
      "O",
      // 0-99 deposits in any order
      ...Array.from({ length: 100 }, () => "D"),
      ...Array.from({ length: 50 }, () => "W"),
      "L", // last deposit
    ]);
  });
});
