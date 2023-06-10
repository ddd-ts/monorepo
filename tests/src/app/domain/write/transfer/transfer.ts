import { EsAggregate, EsEvent, Event } from "@ddd-ts/event-sourcing";
import { AccountId } from "../account/account-id";

import { v4 } from "uuid";

export class TransferInitiated extends Event({
  transferId: String,
  from: AccountId,
  to: AccountId,
  amount: Number,
}) {}

export class TransferAmountClaimed extends Event({
  transferId: String,
}) {}

export class Transfer extends EsAggregate<
  string,
  [TransferInitiated, TransferAmountClaimed]
> {
  public from: AccountId;
  public to: AccountId;
  public amount: number;
  public amountClaimed: boolean = false;

  @EsAggregate.on(TransferInitiated)
  onTransferInitiated(event: TransferInitiated) {
    this.from = event.payload.from;
    this.to = event.payload.to;
    this.amount = event.payload.amount;
  }

  @EsAggregate.on(TransferAmountClaimed)
  onAmountClaimed(event: TransferAmountClaimed) {
    this.amountClaimed = true;
  }

  static new(from: AccountId, to: AccountId, amount: number) {
    const transfer = this.instanciate(v4());
    transfer.apply(
      TransferInitiated.newChange({
        amount,
        from,
        to,
        transferId: transfer.id,
      })
    );
    return transfer;
  }

  markAmountClaimed() {
    this.apply(TransferAmountClaimed.newChange({ transferId: this.id }));
  }

  static deserialize(
    transferId: string,
    from: AccountId,
    to: AccountId,
    amount: number,
    amountClaimed: boolean
  ) {
    const transfer = this.instanciate(transferId);
    transfer.from = from;
    transfer.to = to;
    transfer.amount = amount;
    transfer.amountClaimed = amountClaimed;
    return transfer;
  }
}
