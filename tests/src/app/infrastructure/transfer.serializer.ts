import { Serialized, type ISerializer, AutoSerializer } from "@ddd-ts/core";
import { AccountId } from "../domain/write/account/account-id";
import {
  Transfer,
  TransferAmountClaimed,
  TransferId,
  TransferInitiated,
} from "../domain/write/transfer/transfer";

export class TransferSerializer implements ISerializer<Transfer> {
  serialize(model: Transfer) {
    return {
      id: model.transferId.serialize(),
      from: model.from.serialize(),
      to: model.to.serialize(),
      amount: model.amount,
      amountClaimed: model.amountClaimed,
      version: 1,
    };
  }

  async deserialize(serialized: Serialized<this>) {
    return new Transfer(
      TransferId.deserialize(serialized.id),
      AccountId.deserialize(serialized.from),
      AccountId.deserialize(serialized.to),
      serialized.amount,
      serialized.amountClaimed,
    );
  }
}

export class TransferInitiatedSerializer extends AutoSerializer(
  TransferInitiated,
  1,
) {}

export class TransferAmountClaimedSerializer extends AutoSerializer(
  TransferAmountClaimed,
  1,
) {}
