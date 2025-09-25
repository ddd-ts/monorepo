import { caseFixture, traits, locks } from "../testkit/case-fixture";

jest.setTimeout(180_000);

const test = caseFixture("Defer", {
  handlers: {
    Deposited: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.ClaimTimeout(2_000),
        traits.IsolateAfter(1),
        traits.Sequential(),
      ],
      lock: locks.wholeAccount,
    },
  },
  projector: {
    retry: { attempts: 10, minDelay: 100, maxDelay: 100, backoff: 1 },
  },
});

test.describe(() => {
  it("will allow more breathing time if a previous locking event is being processed", async () => {
    const { events, act, control, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    const failing = account.deposit(1000);
    const next = account.deposit(100);
    await act.save(account);

    const unmark = control.markFailing(failing);
    // const h1 = act.handle(failing);
    const h2 = act.handle(next);

    await control.wait(100);

    // await control.wait(2_000);

    assert.cashflow(account.id).toHave({ flow: 0 });

    unmark();
    // await h1;
    await h2;

    assert.cashflow(account.id).toHave({ flow: 1100 });
  });
});
