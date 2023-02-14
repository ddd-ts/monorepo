import { EsAggregate } from "@ddd-ts/event-sourcing";
import { v4 } from "uuid";
import { AccountId } from "./account-id";
import { Deposited } from "./deposited.event";

export class Account extends EsAggregate<
  AccountId,
  [
    Deposited,
    {
      type: "Withdrawn";
      id: string;
      payload: { amount: number };
      revision?: bigint;
    }
  ]
> {
  balance = 0;

  constructor(public id: AccountId) {
    super(id);
  }

  deposit(amount: number) {
    this.apply(Deposited.new({ accountId: this.id, amount }));
  }

  @EsAggregate.on(Deposited)
  onDeposited(deposited: Deposited) {
    this.balance += deposited.payload.amount;
  }

  withdraw(amount: number) {
    this.apply({
      type: "Withdrawn",
      id: v4(),
      payload: { amount },
      revision: undefined,
    });
  }

  static new() {
    const accountId = AccountId.generate();
    const account = this.instanciate(accountId);
    return account;
  }

  static deserialize(id: AccountId, balance: number, revision: bigint) {
    const account = new Account(id);
    account.balance = balance;
    account.acknowledgedRevision = revision;
    return account;
  }
}
