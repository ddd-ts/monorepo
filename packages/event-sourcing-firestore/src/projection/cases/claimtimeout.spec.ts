import { caseFixture, locks, traits } from "../testkit/case-fixture";

const test = caseFixture("ClaimTimeout", {
  handlers: {
    AccountOpened: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.ClaimTimeout(1000),
        traits.Parallel(),
        traits.Suspense(),
      ],
      lock: locks.wholeAccount,
    },
  },
  projector: {
    retry: { attempts: 3, minDelay: 500, maxDelay: 500 },
    unclaimOnFailure: false,
  },
});

test.describe(() => {
  it("will process any previous event that disappeared for too long", async () => {
    const { events, act, control, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);

    const reallow = await control.markFailing(opened);

    // this one will retry 3 times from breathing, but will still fail
    await act.handle(opened).catch(() => {});

    // after 3 attempts, the claim timeout should have been exceeded (1s vs 500ms * 3)
    // so we can re-allow the handler to complete.
    reallow();

    // now the next event will make the first one succeed
    const deposited = account.deposit(100);
    await act.save(account);
    await act.handle(deposited);

    await assert.cashflow(account.id).toHave({ id: account.id, flow: 100 });
  });
});
