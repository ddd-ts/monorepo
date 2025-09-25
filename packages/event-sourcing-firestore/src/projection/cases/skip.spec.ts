import { caseFixture, locks, traits } from "../testkit/case-fixture";

jest.setTimeout(20_000);

const test = caseFixture("Skip", {
  projector: {
    // unclaimOnFailure: false,
    retry: { attempts: 10, minDelay: 100, maxDelay: 100 },
  },
  handlers: {
    Deposited: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.SkipAfter(5),
        traits.Suspense(),
        traits.Sequential(),
      ],
      // Ensures that a failing event will block all next ones
      lock: locks.wholeAccount,
    },
  },
});

test.describe(() => {
  it("skips failing event and processes others", async () => {
    const { events, act, control, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    const failing = account.deposit(1000);
    await act.save(account);

    const reallow = control.markFailing(failing);

    await act.handle(failing).catch(() => {});

    await assert.cashflow(account.id).toHave({ flow: 0 });

    const d1 = account.deposit(100);
    await act.save(account);
    await act.handle(d1);

    const w1 = account.withdraw(50);
    await act.save(account);
    await act.handle(w1);

    await assert.cashflow(account.id).toHave({ flow: 150 });

    reallow();
  });
});

const testunclaim = caseFixture("SkipClaim", {
  projector: {
    unclaimOnFailure: false,
    // unclaimOnFailure: false,
    retry: { attempts: 10, minDelay: 100, maxDelay: 100 },
  },
  handlers: {
    Deposited: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.SkipAfter(5),
        traits.Suspense(),
        traits.Sequential(),
      ],
      // Ensures that a failing event will block all next ones
      lock: locks.wholeAccount,
    },
  },
});

testunclaim.describe(() => {
  it("skips failing event and processes others", async () => {
    const { events, act, control, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    const failing = account.deposit(1000);
    await act.save(account);

    const reallow = control.markFailing(failing);

    await act.handle(failing).catch(() => {});

    await assert.cashflow(account.id).toHave({ flow: 0 });

    const d1 = account.deposit(100);
    await act.save(account);
    await act.handle(d1);

    const w1 = account.withdraw(50);
    await act.save(account);
    await act.handle(w1);

    await assert.cashflow(account.id).toHave({ flow: 150 });

    reallow();
  });
});
