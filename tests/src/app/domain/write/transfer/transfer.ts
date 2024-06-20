import { EsAggregate, EsEvent, On } from "@ddd-ts/core";
import { AccountId } from "../account/account-id";

import { v4 } from "uuid";

export class TransferInitiated extends EsEvent("TransferInitiated", {
  transferId: String,
  from: AccountId,
  to: AccountId,
  amount: Number,
}) {}

export class TransferAmountClaimed extends EsEvent("TransferAmountClaimed", {
  transferId: String,
}) {}

export class Transfer extends EsAggregate("Transfer", {
  events: [TransferInitiated, TransferAmountClaimed],
}) {
  constructor(
    public transferId: string,
    public from: AccountId,
    public to: AccountId,
    public amount: number,
    public amountClaimed = false,
  ) {
    super({});
    this.id = transferId;
  }

  @On(TransferInitiated)
  static onTransferInitiated(event: TransferInitiated) {
    return new Transfer(
      event.payload.transferId,
      event.payload.from,
      event.payload.to,
      event.payload.amount,
    );
  }

  @On(TransferAmountClaimed)
  onAmountClaimed(event: TransferAmountClaimed) {
    this.amountClaimed = true;
  }

  static initiate(from: AccountId, to: AccountId, amount: number) {
    return this.new(
      TransferInitiated.new({
        amount,
        from,
        to,
        transferId: v4(),
      }),
    );
  }

  markAmountClaimed() {
    this.apply(TransferAmountClaimed.new({ transferId: this.transferId }));
  }

  static deserialize(
    transferId: string,
    from: AccountId,
    to: AccountId,
    amount: number,
    amountClaimed: boolean,
  ) {
    return new Transfer(transferId, from, to, amount, amountClaimed);
  }
}
