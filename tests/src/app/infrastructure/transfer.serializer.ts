import { Serializer, Serialized } from "@ddd-ts/model";
import { AccountId } from "../domain/write/account/account-id";
import { Transfer } from "../domain/write/transfer/transfer";

export class TransferSerializer extends Serializer<Transfer> {
  serialize(model: Transfer) {
    return {
      id: model.id.toString(),
      from: model.from.toString(),
      to: model.to.toString(),
      amount: model.amount,
      amountClaimed: model.amountClaimed,
    };
  }

  deserialize(serialized: Serialized<this>) {
    return Transfer.deserialize(
      serialized.id,
      AccountId.deserialize(serialized.from),
      AccountId.deserialize(serialized.to),
      serialized.amount,
      serialized.amountClaimed
    );
  }

  getIdFromModel(model: Transfer) {
    return model.id;
  }

  getIdFromSerialized(serialized: Serialized<this>) {
    return serialized.id;
  }
}
