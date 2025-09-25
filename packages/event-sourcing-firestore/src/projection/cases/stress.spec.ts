import { caseFixture, locks, traits } from "../testkit/case-fixture";

jest.setTimeout(180_000);

const test = caseFixture("Stress", {
  handlers: {
    AccountOpened: {
      chain: [traits.Context(), traits.Transaction(), traits.Parallel()],
      lock: locks.wholeAccount,
    },
    Deposited: {
      chain: [traits.Context(), traits.Parallel(), traits.Transaction()],
      lock: locks.accountAndEventId, // allows parallel deposits
    },
    Withdrawn: {
      chain: [traits.Context(), traits.Parallel(), traits.Transaction()],
      lock: locks.accountAndEventId, // forces sequential withdrawals
    },
  },
});

class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

test.describe(() => {
  it("processes a realistic mix of operations deterministically", async () => {
    const { events, act, cashflowStore } = await test.setup();

    const [account, opened] = events.open(test.name);
    await act.save(account);
    await act.handle(opened);

    const rng = new SeededRandom(12345);
    const ops = 100;
    let expectedFlow = 0;
    let renameCount = 0;

    const toHandle: any[] = [];
    for (let i = 0; i < ops; i++) {
      const r = rng.next();
      if (r < 0.6) {
        const amount = Math.floor(rng.next() * 500) + 10;
        expectedFlow += amount;
        toHandle.push(account.deposit(amount));
      } else if (r < 0.85 && expectedFlow > 50) {
        const maxWithdraw = Math.min(expectedFlow - 10, 200);
        const amount = Math.floor(rng.next() * maxWithdraw) + 1;
        expectedFlow += amount;
        toHandle.push(account.withdraw(amount));
      } else {
        const nameId = renameCount.toString().padStart(3, "0");
        toHandle.push(account.rename(`WorkflowName_${nameId}`));
        renameCount++;
      }
      // if (i % 25 === 24) {
      //   await act.save(account);
      // }
    }
    await act.save(account);

    await Promise.all(toHandle.map((e) => act.handle(e)));

    // await new Promise((r) => setTimeout(r, 5000)); // Wait for eventual consistency

    const cashflow = await cashflowStore.load(account.id);
    expect(cashflow).toBeDefined();
    expect(cashflow!.flow).toBe(expectedFlow);
    expect(cashflow!.name).toBe(
      `WorkflowName_${(renameCount - 1).toString().padStart(3, "0")}`,
    );
  });
});
