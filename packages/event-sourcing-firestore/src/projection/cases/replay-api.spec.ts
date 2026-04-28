import { Cursor } from "@ddd-ts/core";
import { CheckpointId } from "@ddd-ts/core";
import { caseFixture, locks, traits } from "../testkit/case-fixture";
import { FirestoreQueueStore } from "../firestore.projector";

jest.setTimeout(120_000);

const test = caseFixture("ReplayApi", {
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
  projector: {
    retry: { attempts: 5, minDelay: 50, maxDelay: 50 },
    enqueue: { batchSize: 50 },
  },
});

test.describe(() => {
  it("catchup() enqueues + drains to completion", async () => {
    const { events, act, projector, projection, queueStore, assert } =
      await test.setup();

    const [account, opened] = events.open(`${test.name}-catchup`);
    await act.save(account);
    account.deposit(10);
    account.deposit(20);
    account.deposit(30);
    await act.save(account);

    const checkpointId = projection.getCheckpointId(opened);

    // Don't call handle(); use catchup() to drive replay end-to-end.
    await projector.catchup(checkpointId, { deadlineMs: 30_000 });

    expect(await queueStore.hasUnprocessed(checkpointId)).toBe(false);
    await assert.cashflow(account.id).toHave({
      id: account.id,
      flow: 60,
    });
  });

  it("play() wipes queue and replays from the beginning", async () => {
    const { events, act, projector, projection, queueStore, cashflowStore, assert } =
      await test.setup();

    const [account, opened] = events.open(`${test.name}-play`);
    await act.save(account);
    account.deposit(5);
    account.deposit(7);
    await act.save(account);

    const checkpointId = projection.getCheckpointId(opened);

    // Bring the projection up to date once.
    await projector.catchup(checkpointId, { deadlineMs: 30_000 });
    await assert.cashflow(account.id).toHave({ flow: 12 });

    // Reset projection state — play() only resets the queue, callers
    // are responsible for wiping read-model state before replay.
    await (cashflowStore as any).delete(account.id);

    // Replay from scratch — should converge to the same state.
    await projector.play(checkpointId);
    expect(await queueStore.hasUnprocessed(checkpointId)).toBe(false);
    await assert.cashflow(account.id).toHave({ flow: 12 });
  });

  it("flush({except}) preserves the blocker", async () => {
    const { events, act, projection, queueStore } = await test.setup();
    const [account, opened] = events.open(`${test.name}-flush-except`);
    await act.save(account);
    account.deposit(1);
    await act.save(account);

    const checkpointId = projection.getCheckpointId(opened);

    await queueStore.block(checkpointId);
    await queueStore.flush(checkpointId, {
      except: [FirestoreQueueStore.BLOCKER_EVENT_ID],
    });

    const blockerDoc = await queueStore
      .queued(checkpointId, FirestoreQueueStore.BLOCKER_EVENT_ID)
      .get();
    expect(blockerDoc.exists).toBe(true);

    await queueStore.unblock(checkpointId);
    const afterUnblock = await queueStore
      .queued(checkpointId, FirestoreQueueStore.BLOCKER_EVENT_ID)
      .get();
    expect(afterUnblock.exists).toBe(false);
  });

  it("enqueueCursor({ idempotent }) is safe to re-trigger", async () => {
    const { events, act, projector, projection } = await test.setup();
    const [account, opened] = events.open(`${test.name}-idempotent-enqueue`);
    await act.save(account);
    account.deposit(1);
    await act.save(account);

    const checkpointId = projection.getCheckpointId(opened);
    const fact = await projector.reader.first(
      projection.getSource(),
      checkpointId.shard(),
    );
    if (!fact) throw new Error("expected a fact");
    const cursor = Cursor.from(fact);

    await projector.enqueueCursor(checkpointId, cursor, { idempotent: true });
    // Re-triggering should not throw ALREADY_EXISTS.
    await projector.enqueueCursor(checkpointId, cursor, { idempotent: true });
  });

  it("shouldHandle gates handle() without enqueueing", async () => {
    const { events, act, projection, queueStore, projector } =
      await test.setup();

    projector.config.shouldHandle = async () => false;

    const [account, opened] = events.open(`${test.name}-should-handle`);
    await act.save(account);

    await projector.handle(opened);

    const checkpointId = projection.getCheckpointId(opened);
    expect(await queueStore.hasUnprocessed(checkpointId)).toBe(false);
  });
});
