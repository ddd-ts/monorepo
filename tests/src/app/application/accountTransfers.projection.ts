import { On, Projection } from "@ddd-ts/core";
import { TransferInitiated } from "../domain/write/transfer/transfer";
import type { AccountTransfersStore } from "./accountTransfers.store";

export class InitiatedTransfersProjection extends Projection(
  "InitiatedTransfers",
  [TransferInitiated],
) {
  constructor(private readonly store: AccountTransfersStore) {
    super({});
  }

  @On(TransferInitiated)
  async onTransferInitiated(fact: TransferInitiated) {
    const accountTransfers = await this.store.load(fact.payload.from);
    if (!accountTransfers) {
      throw new Error("Account does not exist");
    }

    accountTransfers.registerInitiatedTransfer();

    await this.store.save(accountTransfers);
  }
}
