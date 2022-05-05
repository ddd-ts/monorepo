import {
  Transaction,
  TransactionPerformer,
  TransactionEffect,
} from "./transaction";

export class InMemoryTransactionPerformer extends TransactionPerformer {
  async perform<T>(
    effect: (transaction: Transaction) => Promise<T>
  ): Promise<T> {
    const trx = new InMemoryTransaction();
    try {
      const result = await effect(trx);
      await trx.commit();
      return result;
    } catch (e) {
      await trx.rollback();
      return Promise.reject(e);
    }
  }
}

export class InMemoryTransaction extends Transaction {
  id = Math.random().toString();

  rollbackEffects: TransactionEffect[] = [];
  commitEffects: TransactionEffect[] = [];

  async rollback() {
    for (const rollbackEffect of this.rollbackEffects) {
      await rollbackEffect();
    }
  }

  async commit() {
    for (const commitEffect of this.commitEffects) {
      await commitEffect();
    }
  }

  onCommit(effect: TransactionEffect): void {
    this.commitEffects.push(effect);
  }

  onRollback(rollbackEffect: TransactionEffect) {
    this.rollbackEffects.push(rollbackEffect);
  }
}
