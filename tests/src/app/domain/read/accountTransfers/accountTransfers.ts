import { AccountId } from "../../write/account/account-id";

export class AccountTransfers {
  constructor(
    public readonly accountId: AccountId,
    public initiatedTransferCount: number = 0
  ) {}

  get id() {
    return this.accountId;
  }

  registerInitiatedTransfer() {
    this.initiatedTransferCount += 1;
  }
}
