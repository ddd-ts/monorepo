import { caseFixture, locks, traits } from "../testkit/case-fixture";

const test = caseFixture("Concurrency", {
  handlers: {
    Deposited: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.Delay(1000),
        traits.Parallel(),
      ],
      lock: locks.accountAndEventId,
    },
    Withdrawn: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.Parallel(),
      ],
      lock: locks.accountAndEventId,
    },
  },
  projector: {
    unclaimOnFailure: false,
    retry: { attempts: 5, minDelay: 100, maxDelay: 100 },
  },
});

test.describe(() => {
  it("handles two events of the same account in parallel (time-based)", async () => {
    const { events, act, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    // Deposit before withdraw
    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);
    await act.save(account);

    await Promise.all([act.handle(withdraw), act.handle(deposit)]);

    await assert.cashflow(account.id).toHave({
      // But withdraw is first in ops_trace, because it has no delay
      ops_trace: [opened.id, withdraw.id, deposit.id],
      flow: 150,
    });
  });
});
