import { Primitive } from "@ddd-ts/shape";
import { StableId } from "./stable-id";
import { EsEvent } from "../../../makers/es-event";
import { On } from "../../../decorators/handlers";
import { EsAggregate } from "../../../makers/es-aggregate";
import type { ISavedChange } from "../../../interfaces/es-event";

export class AccountId extends Primitive(String) {
  static generate(test: string) {
    return new AccountId(`A${StableId.generate(test).serialize()}`);
  }
}

export class AccountOpened extends EsEvent("AccountOpened", {
  accountId: AccountId,
}) {
  declare static name: "AccountOpened";
  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Opened()`;
  }
}

export class Deposited extends EsEvent("Deposited", {
  accountId: AccountId,
  amount: Number,
}) {
  declare static name: "Deposited";
  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Deposited(${this.payload.amount})`;
  }
}

export class Withdrawn extends EsEvent("Withdrawn", {
  accountId: AccountId,
  amount: Number,
}) {
  declare static name: "Withdrawn";
  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Withdrawn(${this.payload.amount})`;
  }
}

export class AccountRenamed extends EsEvent("AccountRenamed", {
  accountId: AccountId,
  newName: String,
}) {
  declare static name: "AccountRenamed";
  // id = StableEventId.generate();
  toString() {
    return `Account<${this.payload.accountId.serialize()}>:Renamed(${this.payload.newName})`;
  }
}

export class Account extends EsAggregate("Account", {
  events: [AccountOpened, Deposited, Withdrawn, AccountRenamed],
  state: {
    id: AccountId,
    name: String,
    balance: Number,
  },
}) {
  static open(test: string) {
    const accountId = AccountId.generate(test);
    const change = AccountOpened.new({ accountId });
    const instance = this.new(change);
    return [instance, change as ISavedChange<typeof change>] as const;
  }

  @On(AccountOpened)
  static onOpened(event: AccountOpened) {
    return new Account({
      id: event.payload.accountId,
      name: event.payload.accountId.serialize(),
      balance: 0,
    });
  }

  deposit(amount: number) {
    const change = Deposited.new({
      accountId: this.id,
      amount,
    });
    this.apply(change);
    return change as ISavedChange<typeof change>;
  }

  @On(Deposited)
  onDeposited(event: Deposited) {
    this.balance += event.payload.amount;
  }

  withdraw(amount: number) {
    const change = Withdrawn.new({
      accountId: this.id,
      amount,
    });
    this.apply(change);
    return change as ISavedChange<typeof change>;
  }

  @On(Withdrawn)
  onWithdrawn(event: Withdrawn) {
    this.balance -= event.payload.amount;
  }

  rename(newName: string) {
    const change = AccountRenamed.new({
      accountId: this.id,
      newName,
    });
    this.apply(change);
    return change as ISavedChange<typeof change>;
  }

  @On(AccountRenamed)
  onRenamed(event: AccountRenamed) {
    this.name = event.payload.newName;
  }
}
