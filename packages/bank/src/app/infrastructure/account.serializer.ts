import { Serializer, Serialized } from "@ddd-ts/event-sourcing";
import { Account } from "../domain/write/account/account";
import { AccountId } from "../domain/write/account/account-id";
import { Cashflow } from "../domain/read/cashflow/cashflow";

export class AccountSerializer extends Serializer<Account> {
  serialize(model: Account) {
    return {
      id: model.id.toString(),
      balance: model.balance,
      revision: Number(model.acknowledgedRevision),
    };
  }

  deserialize(serialized: Serialized<this>) {
    const account = Account.deserialize(
      AccountId.deserialize(serialized.id),
      serialized.balance,
      BigInt(serialized.revision)
    );

    return account;
  }

  getIdFromModel(model: Account) {
    return model.id;
  }
}
