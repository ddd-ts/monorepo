import { TransactionPerformer } from "@ddd-ts/model";
import {
  InMemoryDatabase,
  InMemoryUnderlyingTransaction,
} from "./store/in-memory.database";

export class InMemoryTransaction {
  commitListeners: (() => void)[] = [];

  constructor(public readonly transaction: InMemoryUnderlyingTransaction) {}

  onCommit(callback: () => void) {
    this.commitListeners.push(callback);
  }

  async executeCommitListeners() {
    await Promise.all(this.commitListeners.map((cb) => cb()));
  }
}

export class InMemoryTransactionPerformer extends TransactionPerformer<InMemoryTransaction> {
  constructor(db: InMemoryDatabase) {
    super((effect) => db.transactionally((trx) => effect(trx)));
  }
}

export class FakeInMemoryTransactionPerformer extends TransactionPerformer<InMemoryTransaction> {
  constructor() {
    super((effect) => effect(new InMemoryTransaction(null as any)));
  }
}
