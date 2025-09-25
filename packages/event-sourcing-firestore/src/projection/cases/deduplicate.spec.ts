import { caseFixture } from "../testkit/case-fixture";

const test = caseFixture("Deduplicate");

test.describe(() => {
  it("ignores duplicate withdraw events and applies once", async () => {
    const { events, act, assert } = await test.setup();

    const [account, opened] = events.open(test.name);

    const deposit = account.deposit(100);
    const withdraw = account.withdraw(50);

    await act.save(account);

    await act.handle(opened);

    await Promise.all([
      // Those two withdraws are duplicates and only one should be applied
      act.handle(withdraw),
      act.handle(withdraw),
      act.handle(deposit),
    ]);

    await assert.cashflow(account.id).toHave({ id: account.id, flow: 150 });
  });
});
