import { Fact, Projection } from "@ddd-ts/event-sourcing";
import { Transaction } from "@ddd-ts/model";
import { Account } from "../domain/write/account/account";
import { Transfer, TransferInitiated } from "../domain/write/transfer/transfer";
import { AccountTransfersStore } from "./accountTransfers.store";

export class InitiatedTransfersProjection extends Projection {
  constructor(private readonly store: AccountTransfersStore) {
    super();
  }

  on = [Account, Transfer];

  @Projection.on(TransferInitiated)
  async onTransferInitiated(fact: Fact<TransferInitiated>, trx?: Transaction) {
    const accountTransfers = await this.store.load(fact.payload.from);
    if (!accountTransfers) {
      throw new Error("Account does not exist");
    }

    accountTransfers.registerInitiatedTransfer();

    await this.store.save(accountTransfers, trx);
  }
}
