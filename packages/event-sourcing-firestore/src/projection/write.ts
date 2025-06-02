import { EsAggregate, EsEvent, EventId, On } from "@ddd-ts/core";
import { Primitive } from "../../../shape/dist";

export class StableEventId extends Primitive(String) {
  static seed = Math.random().toString(36).substring(2, 5);
  static current = 0;

  static generate() {
    return new EventId(
      String(`${this.seed}-${++this.current}`).padStart(5, "0"),
    );
  }
}

export class AccountId extends Primitive(String) {
  static generate() {
    return new AccountId(`A${StableEventId.generate().serialize()}`);
  }
}

export class BankId extends Primitive(String) {
  static generate() {
    return new BankId(`B${StableEventId.generate().serialize()}`);
  }
}

export class AccountOpened extends EsEvent("AccountOpened", {
  accountId: AccountId,
  bankId: BankId,
}) {
  // id = StableEventId.generate();

  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Opened()`;
  }
}

export class Deposited extends EsEvent("Deposited", {
  bankId: BankId,
  accountId: AccountId,
  amount: Number,
}) {
  // id = StableEventId.generate();
  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Deposited(${this.payload.amount})`;
  }
}

export class Withdrawn extends EsEvent("Withdrawn", {
  bankId: BankId,
  accountId: AccountId,
  amount: Number,
}) {
  // id = StableEventId.generate();
  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Withdrawn(${this.payload.amount})`;
  }
}

export class Account extends EsAggregate("Account", {
  events: [AccountOpened, Deposited, Withdrawn],
  state: {
    id: AccountId,
    bankId: BankId,
    balance: Number,
  },
}) {
  static open(bankId: BankId) {
    const accountId = AccountId.generate();
    const change = AccountOpened.new({ accountId, bankId });
    const instance = this.new(change);
    return [instance, change] as const;
  }

  @On(AccountOpened)
  static onOpened(event: AccountOpened) {
    return new Account({
      id: event.payload.accountId,
      bankId: event.payload.bankId,
      balance: 0,
    });
  }

  deposit(amount: number) {
    const change = Deposited.new({
      accountId: this.id,
      amount,
      bankId: this.bankId,
    });
    this.apply(change);
    return change;
  }

  @On(Deposited)
  onDeposited(event: Deposited) {
    this.balance += event.payload.amount;
  }

  withdraw(amount: number) {
    const change = Withdrawn.new({
      accountId: this.id,
      amount,
      bankId: this.bankId,
    });
    this.apply(change);
    return change;
  }

  @On(Withdrawn)
  onWithdrawn(event: Withdrawn) {
    this.balance -= event.payload.amount;
  }
}

export class BankCreated extends EsEvent("BankCreated", {
  bankId: BankId,
}) {}

export class AccountRegistered extends EsEvent("AccountRegistered", {
  accountId: AccountId,
  bankId: BankId,
}) {}

export class AccountUnregistered extends EsEvent("AccountUnregistered", {
  accountId: AccountId,
  bankId: BankId,
}) {}

export class Bank extends EsAggregate("Bank", {
  events: [BankCreated, AccountRegistered, AccountUnregistered],
  state: {
    id: BankId,
    accounts: [AccountId],
  },
}) {
  static create() {
    const bankId = BankId.generate();
    return this.new(BankCreated.new({ bankId }));
  }

  @On(BankCreated)
  static onCreated(event: BankCreated) {
    return new Bank({
      id: event.payload.bankId,
      accounts: [],
    });
  }

  registerAccount(accountId: AccountId) {
    return this.apply(AccountRegistered.new({ accountId, bankId: this.id }));
  }

  @On(AccountRegistered)
  onAccountRegistered(event: AccountRegistered) {
    this.accounts.push(event.payload.accountId);
  }

  unregisterAccount(accountId: AccountId) {
    return this.apply(AccountUnregistered.new({ accountId, bankId: this.id }));
  }

  @On(AccountUnregistered)
  onAccountUnregistered(event: AccountUnregistered) {
    this.accounts = this.accounts.filter(
      (id) => id !== event.payload.accountId,
    );
  }
}
