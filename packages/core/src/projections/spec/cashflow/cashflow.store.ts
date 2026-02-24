import { AccountId } from "../account/account";
import { Cashflow } from "./cashflow";
import type { Transaction } from "../../../components/transaction";
import { AutoSerializer } from "../../../components/auto-serializer";

export class CashflowSerializer extends AutoSerializer.First(Cashflow) {}

export interface CashflowStore {
  load(accountId: AccountId): Promise<Cashflow | undefined>;

  init(accountId: AccountId, context?: { trx?: Transaction }): Promise<void>;
  increment(
    accountId: AccountId,
    amount: number,
    context?: { trx?: Transaction },
  ): Promise<void>;

  rename(
    accountId: AccountId,
    newName: string,
    context?: { trx?: Transaction },
  ): Promise<void>;
}
