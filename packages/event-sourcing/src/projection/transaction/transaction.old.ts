export type TransactionEffect = () => Promise<void>;

export abstract class Transaction {
  abstract rollback(): void;
  abstract onRollback(effect: TransactionEffect): void;
  abstract onCommit(effect: TransactionEffect): void;
}

export interface TransactionOptions {
  /**
   *  The maximum amount of time the client will wait to acquire a transaction from the database
   */
  maxWait?: number;
  /**
   * The maximum amount of time the interactive transaction can run before being canceled and rolled back
   */
  timeout?: number;
}

export abstract class TransactionPerformer {
  abstract perform<T>(
    effect: (genericTransaction: Transaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
}
