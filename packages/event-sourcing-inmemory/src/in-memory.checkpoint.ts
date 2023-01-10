import {
  Checkpoint,
  CheckpointFurtherAway,
} from "@ddd-ts/event-sourcing/src/projection/checkpoint/checkpoint";
import {
  InMemoryDatabase,
  InMemoryTransaction,
} from "./store/in-memory.database";

export class InMemoryCheckpoint extends Checkpoint {
  projections = new Map<string, bigint>();

  constructor(private readonly inMemoryDatabase: InMemoryDatabase) {
    super();
  }

  async get(name: string, trx?: InMemoryTransaction) {
    const checkpoint = this.inMemoryDatabase.load("checkpoint", name, trx);
    if (typeof checkpoint === "bigint") {
      return checkpoint;
    }
    return -1n;
  }

  async set(name: string, revision: bigint, trx?: InMemoryTransaction) {
    const current = await this.get(name);
    if (revision < current) {
      throw new CheckpointFurtherAway(name, revision, current);
    }

    this.inMemoryDatabase.save("checkpoint", name, revision, trx);
  }

  async clear() {
    this.inMemoryDatabase.clear("checkpoint");
  }
}
