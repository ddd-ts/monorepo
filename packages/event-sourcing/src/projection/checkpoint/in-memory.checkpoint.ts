import { InMemoryTransaction } from "../transaction/in-memory.transaction";
import { Checkpoint, CheckpointFurtherAway } from "./checkpoint";

export class InMemoryCheckpoint extends Checkpoint {
  projections = new Map<string, bigint>();

  transactions = new Map<string, bigint>();

  async get(name: string, trx?: InMemoryTransaction) {
    if (trx) {
      const transiant = await this.transactions.get(name);
      if (transiant) return transiant;
    }

    if (this.projections.has(name)) {
      return this.projections.get(name)!;
    }
    return -1n;
  }

  async set(name: string, revision: bigint, trx?: InMemoryTransaction) {
    const current = await this.get(name);
    if (revision < current) {
      throw new CheckpointFurtherAway(name, revision, current);
    }

    if (trx) {
      this.transactions.set(trx.id, revision);
    } else {
      this.projections.set(name, revision);
    }

    trx?.onCommit(async () => {
      this.projections.set(name, revision);
      this.transactions.delete(trx.id);
    });
  }

  clear() {
    this.projections.clear();
  }
}
