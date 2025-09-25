import { caseFixture } from "../testkit/case-fixture";

const test = caseFixture("BatchLast");

test.describe(() => {
  it("applies only the last rename in sequence", async () => {
    const { events, act, assert } = await test.setup();

    const [account, opened] = events.open(test.name);

    await act.save(account);
    await act.handle(opened);

    // Those will be skipped because they are not the last in sequence
    account.rename("First Name");
    account.rename("Second Name");

    // This will be applied
    const final = account.rename("Final Name");

    await act.save(account);

    await act.handle(final);

    await assert.cashflow(account.id).toHave({
      id: account.id,
      flow: 0,
      name: "Final Name",
      all_names: ["Final Name"],
      ops_trace: [opened.id, final.id],
    });
  });

  it("will apply last rename of batch", async () => {
    const { events, act, assert } = await test.setup();

    const [account, opened] = events.open("SimpleBatching_DSL");
    await act.save(account);
    await act.handle(opened);

    account.rename("New Name A");
    account.rename("New Name B");
    account.rename("New Name C");
    const r1 = account.rename("New Name 1");
    await act.save(account);

    await act.handle(r1);

    account.rename("New Name H");
    account.rename("New Name I");
    account.rename("New Name J");
    const r2 = account.rename("New Name 2");
    await act.save(account);

    await act.handle(r2);

    await assert.cashflow(account.id).toHave({
      id: account.id,
      flow: 0,
      name: "New Name 2",
      all_names: ["New Name 1", "New Name 2"],
    });
  });
});
