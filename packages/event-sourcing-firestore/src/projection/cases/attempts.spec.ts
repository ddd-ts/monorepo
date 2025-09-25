import { caseFixture } from "../testkit/case-fixture";

const test = caseFixture("Breathing", {
  projector: {
    retry: { attempts: 3, minDelay: 10, maxDelay: 10 },
    enqueue: { batchSize: 100 },
  },
});

test.describe(() => {
  it("will attempt multiple retries when handler explicitely fails", async () => {
    const { events, act, control, assert } = await test.setup();

    const [account, opened] = events.open(`${test.name}_1`);
    await act.save(account);

    // Only one handle call, but we will fail multiple times inside
    const operation = act.handle(opened);

    const first = await control.suspend(opened);
    first.fail(new Error("first"));

    const second = await control.suspend(opened);
    second.fail(new Error("second"));

    const catched = await control.suspend(opened);
    catched.resume();

    await operation;

    await assert.cashflow(account.id).toHave({ id: account.id, flow: 0 });
  });

  it("but if we exceed the max attempts, the operation should fail", async () => {
    const { events, act, control, assert } = await test.setup();

    const [account, opened] = events.open(`${test.name}_2`);
    await act.save(account);

    const operation = act.handle(opened);

    const first = await control.suspend(opened);
    first.fail(new Error("first"));

    const second = await control.suspend(opened);
    second.fail(new Error("second"));

    // This is the third failure, which exceeds the max attempts of 3
    const third = await control.suspend(opened);
    third.fail(new Error("third"));

    await operation.catch(() => {});

    await assert.cashflow(account.id).toNotExist();
  });
});
