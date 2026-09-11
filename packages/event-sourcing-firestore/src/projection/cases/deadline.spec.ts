import { CheckpointId, Cursor } from "@ddd-ts/core";

import { FirestoreProjector } from "../firestore.projector";

jest.setTimeout(30_000);

class StuckProjector extends FirestoreProjector {
  attempts = 0;

  async attempt(): Promise<any> {
    this.attempts += 1;
    return ["DEFERRED", "never makes progress"] as const;
  }
}

function stuckProjector() {
  const projection = { getSource: () => ({}) } as any;
  const reader = {} as any;
  const queue = {
    hasUnprocessed: async () => true,
    head: async () => Cursor.MAX,
  } as any;

  return new StuckProjector(projection, reader, queue, {
    retry: { attempts: 1, minDelay: 1, maxDelay: 1, backoff: 1 },
    enqueue: { batchSize: 1 },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    onProcessError: () => {},
    onEnqueueError: () => {},
  });
}

describe("Drain deadline", () => {
  it("gives up on a queue that never empties instead of spinning forever", async () => {
    const projector = stuckProjector();
    const checkpointId = new CheckpointId("Deadline@@stuck");

    const startedAt = Date.now();

    await expect(
      projector.dequeue(checkpointId, { deadlineMs: 200 }),
    ).rejects.toThrow("deadline of 200ms exceeded");

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(projector.attempts).toBeGreaterThan(0);
  });

  it("drains without a deadline when none is given", async () => {
    const projector = stuckProjector();
    let unprocessed = 3;
    (projector.queue as any).hasUnprocessed = async () => unprocessed-- > 0;

    await expect(
      projector.dequeue(new CheckpointId("Deadline@@finite")),
    ).resolves.toBeUndefined();
  });
});
