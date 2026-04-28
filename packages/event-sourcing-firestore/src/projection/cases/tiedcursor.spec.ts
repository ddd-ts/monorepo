import { Timestamp } from "firebase-admin/firestore";
import { caseFixture, locks, traits } from "../testkit/case-fixture";

jest.setTimeout(120_000);

const test = caseFixture("TiedCursor", {
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
  it("converges when events share (occurredAt, revision)", async () => {
    const { db, events, act, accountStore, assert } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);

    // Process opened first so the cashflow doc exists.
    await act.handle(opened);

    const deposits = [
      account.deposit(1),
      account.deposit(2),
      account.deposit(3),
      account.deposit(4),
      account.deposit(5),
    ];
    await act.save(account);

    // Force ties: all deposits get the same (occurredAt, revision) and that
    // tie group occurs strictly after opened. This mimics a bulk import where
    // the producer assigns timestamps at a coarser granularity than
    // Firestore's microsecond storage.
    const tiedAt = Timestamp.fromMillis(Date.now() + 60_000);
    const tiedRevision = 99;
    const collection = db
      .collection("event-store")
      .doc("Account")
      .collection("streams")
      .doc(account.id.serialize())
      .collection("events");

    await Promise.all(
      deposits.map(async (d) => {
        await collection.doc(`${(d as any).revision}`).update({
          occurredAt: tiedAt,
          revision: tiedRevision,
        });
      }),
    );

    // Now call handle() on each. The projector's queue/head/slice logic
    // must cope with the tie group without losing or duplicating tasks.
    await act.handle(opened);
    await Promise.all(deposits.map((d) => act.handle(d)));

    await assert.cashflow(account.id).toHave({
      id: account.id,
      flow: account.balance,
    });
  });
});
