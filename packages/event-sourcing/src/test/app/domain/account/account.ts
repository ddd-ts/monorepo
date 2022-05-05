import { v4 } from "uuid";
import { EsAggregate } from "../../../../es-aggregate/es-aggregate";
import { AccountId } from "./account-id";
import { Deposited } from "./deposited.event";

export class Account extends EsAggregate<
  AccountId,
  | Deposited
  | {
      type: "Withdrawn";
      id: string;
      payload: { amount: number };
      revision?: bigint;
    }
> {
  balance = 0;

  constructor(public id: AccountId) {
    super(id);
  }

  deposit(amount: number) {
    this.apply(Deposited.newChange(amount));
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

  // @EsAggregate.on("Withdrawn") // should work
  // onWithdrawn(withdrawn: { amount: number }) {}

  static new() {
    return new Account(AccountId.generate());
  }
}
