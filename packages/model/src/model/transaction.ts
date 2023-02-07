export type TransactionEffect<Result> = (
  transaction: Transaction
) => Promise<Result>;

export interface Transaction {}

export abstract class TransactionPerformer {
  constructor(
    private readonly createTransaction: <Result>(
      effect: TransactionEffect<Result>
    ) => Promise<Result>
  ) {}

  perform<Result>(effect: TransactionEffect<Result>) {
    return this.createTransaction(effect);
  }

  /** @deprecated use .perform instead */
  transactionnally = this.perform.bind(this);
}
