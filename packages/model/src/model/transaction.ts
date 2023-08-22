export type TransactionEffect<Result, T extends Transaction = Transaction> = (
  transaction: T
) => Promise<Result>;

export type CommitListener = () => void;

export type Transaction = {
  onCommit(listener: CommitListener): void;
  executeCommitListeners(): Promise<void>;
}

export abstract class TransactionPerformer<
  T extends Transaction = Transaction
> {
  constructor(
    private readonly createTransaction: <Result>(
      effect: TransactionEffect<Result, T>
    ) => Promise<Result>
  ) {}

  async perform<Result>(effect: TransactionEffect<Result, T>) {
    const [result, trx] = await this.createTransaction(async (trx) => [await effect(trx), trx] as const);
    await trx.executeCommitListeners()
    return result;
  }

  /** @deprecated use .perform instead */
  transactionnally = this.perform.bind(this);
}
