import { caseFixture, locks, traits } from "../testkit/case-fixture";

jest.setTimeout(120_000);

const test = caseFixture("Burst", {
  handlers: {
    Deposited: {
      chain: [
        traits.Context(),
        traits.Transaction(),
        traits.Suspense(),
        traits.Parallel(),
      ],
      lock: locks.accountAndEventId,
    },
  },
});

test.describe(() => {
  it("supports many calls to handle, which will produce duplicate work but eventually converges", async () => {
    const { events, act, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    // first 50 deposits, each one its own handle call
    const deposits1 = [...Array(50).keys()].map((i) => account.deposit(i));
    await act.save(account);
    await Promise.all(deposits1.map((e) => act.handle(e)));

    // second 50 deposits, each one its own handle call
    const deposits2 = [...Array(50).keys()].map((i) => account.deposit(i + 50));
    await act.save(account);
    await Promise.all(deposits2.map((e) => act.handle(e)));

    // here we should have exactly the sum of all deposits, without duplicates or misses
    await assert
      .cashflow(account.id)
      .toHave({ id: account.id, flow: account.balance });
  });
});
