import { MakeEventSerializer } from "@ddd-ts/event-sourcing";
import { Serializer, Serialized } from "@ddd-ts/model";
import { AccountId } from "../domain/write/account/account-id";
import {
  Transfer,
  TransferAmountClaimed,
  TransferInitiated,
} from "../domain/write/transfer/transfer";

export class TransferSerializer extends Serializer<Transfer> {
  version = 1n;
  async serialize(model: Transfer) {
    return {
      id: model.id.toString(),
      from: model.from.toString(),
      to: model.to.toString(),
      amount: model.amount,
      amountClaimed: model.amountClaimed,
      version: this.version,
    };
  }

  async deserialize(serialized: Serialized<this>) {
    return Transfer.deserialize(
      serialized.id,
      AccountId.deserialize(serialized.from),
      AccountId.deserialize(serialized.to),
      serialized.amount,
      serialized.amountClaimed
    );
  }
}

export class TransferInitiatedSerializer extends MakeEventSerializer(
  TransferInitiated
) {
  version = 1n;

  async serializePayload(payload: TransferInitiated["payload"]) {
    return {
      transferId: payload.transferId,
      from: payload.from.toString(),
      to: payload.to.toString(),
      amount: payload.amount,
    };
  }

  async deserializePayload(serialized: any) {
    return {
      transferId: serialized.transferId,
      from: AccountId.deserialize(serialized.from),
      to: AccountId.deserialize(serialized.to),
      amount: serialized.amount,
    };
  }
}

export class TransferAmountClaimedSerializer extends MakeEventSerializer(
  TransferAmountClaimed
) {
  version = 1n;

  async serializePayload(payload: TransferAmountClaimed["payload"]) {
    return {
      transferId: payload.transferId,
    };
  }

  async deserializePayload(serialized: any) {
    return {
      transferId: serialized.transferId,
    };
  }
}
