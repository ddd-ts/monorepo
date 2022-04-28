import { EsAggregate } from "../es-aggregate/es-aggregate";
import { Event, Change, Fact } from "../event/event";

export class Deposited implements Event {
  type = "Deposited";

  constructor(
    public id: string,
    public amount: number,
    public revision?: bigint
  ) {}

  static newChange(amount: number) {
    return new Deposited(Math.random().toString(), amount) as Change<Deposited>;
  }

  static newFact(amount: number, revision: bigint) {
    return new Deposited(
      Math.random().toString(),
      amount,
      revision
    ) as Fact<Deposited>;
  }

  static expectedFact(amount: number, revision: bigint) {
    return new Deposited(
      expect.any(String),
      amount,
      revision
    ) as Fact<Deposited>;
  }

  static expectedChange(amount: number) {
    return new Deposited(expect.any(String), amount) as Change<Deposited>;
  }
}

export class AccountId {
  constructor(public value: string) {}

  serialize() {
    return this.value;
  }

  static deserialize(value: string) {
    return new AccountId(value);
  }

  toString() {
    return this.value;
  }

  static generate() {
    return new AccountId(Math.random().toString());
  }
}

export class Account extends EsAggregate<AccountId, Deposited> {
  balance = 0;

  deposit(amount: number) {
    this.apply(Deposited.newChange(amount));
  }

  @EsAggregate.on(Deposited)
  onDeposited(deposited: Deposited) {
    this.balance += deposited.amount;
  }

  static new() {
    return new Account(AccountId.generate());
  }
}
