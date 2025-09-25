import { AutoSerializer, EsAggregate, EsEvent, On } from "@ddd-ts/core";
import { AccountId } from "./account-id";
import { Deposited, Withdrawn } from "./deposited.event";
import { Shape } from "@ddd-ts/shape";

export class AccountOpened extends EsEvent("AccountOpened", {
  accountId: AccountId,
  at: Date,
}) {}

class AccountOpenedAutoSerializer extends AutoSerializer(AccountOpened, 1) {}

export class Account extends EsAggregate("Account", {
  events: [AccountOpened, Deposited, Withdrawn],
  state: {
    id: AccountId,
    balance: Number,
    createdAt: Date,
  },
}) {
  deposit(amount: number) {
    this.apply(Deposited.new({ accountId: this.id, amount }));
  }

  @On(Deposited)
  onDeposited(deposited: Deposited) {
    this.balance += deposited.payload.amount;
  }

  withdraw(amount: number) {
    this.apply(Withdrawn.new({ accountId: this.id, amount }));
  }

  @On(Withdrawn)
  onWithdrawn(withdrawn: Withdrawn) {
    this.balance -= withdrawn.payload.amount;
  }

  static open() {
    const accountId = AccountId.generate();
    return this.new(AccountOpened.new({ accountId, at: new Date() }));
  }

  @On(AccountOpened)
  static onOpened(opened: AccountOpened) {
    return new Account({
      id: opened.payload.accountId,
      balance: 0,
      createdAt: opened.payload.at,
    });
  }
}
