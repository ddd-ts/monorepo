import { Account } from "../domain/write/account/account";
import { AccountId } from "../domain/write/account/account-id";

import { Deposited, Withdrawn } from "../domain/write/account/deposited.event";
import { Serialized, ISerializer, AutoSerializer } from "@ddd-ts/core";

export class AccountSerializer implements ISerializer<Account> {
  serialize(value: Account) {
    return {
      version: 1,
      id: value.id.serialize(),
      balance: value.balance,
    };
  }

  deserialize(value: Serialized<this>) {
    return new Account({
      id: AccountId.deserialize(value.id),
      balance: value.balance,
    });
  }
}

export class DepositedSerializer extends AutoSerializer(Deposited, 1) {}

export class WithdrawnSerializer extends AutoSerializer(Withdrawn, 1) {}
