export type TransactionEffect<Result, T extends Transaction = Transaction> = (
  transaction: T
) => Promise<Result>;

export type Transaction = unknown;

export abstract class TransactionPerformer<
  T extends Transaction = Transaction
> {
  constructor(
    private readonly createTransaction: <Result>(
      effect: TransactionEffect<Result, T>
    ) => Promise<Result>
  ) {}

  perform<Result>(effect: TransactionEffect<Result, T>) {
    return this.createTransaction(effect);
  }

  /** @deprecated use .perform instead */
  transactionnally = this.perform.bind(this);
}
