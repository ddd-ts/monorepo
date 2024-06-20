import { EsEvent } from "@ddd-ts/core";
import { AccountId } from "./account-id";

export class Deposited extends EsEvent("Deposited", {
  accountId: AccountId,
  amount: Number,
}) {}

export class Withdrawn extends EsEvent("Withdrawn", {
  accountId: AccountId,
  amount: Number,
}) {}
