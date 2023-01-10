import { Serializer, Serialized } from "@ddd-ts/event-sourcing";
import { Account } from "../domain/account/account";
import { AccountId } from "../domain/account/account-id";
import { Cashflow } from "../domain/cashflow/cashflow";

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
