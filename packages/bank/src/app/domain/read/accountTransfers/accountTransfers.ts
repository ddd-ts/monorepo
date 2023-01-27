import { AccountId } from "../../write/account/account-id";

export class AccountTransfers {
  constructor(
    public readonly accountId: AccountId,
    public initiatedTransferCount: number = 0
  ) {}

  registerInitiatedTransfer() {
    this.initiatedTransferCount += 1;
  }
}
