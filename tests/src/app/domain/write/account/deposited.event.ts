import { Event } from "@ddd-ts/event-sourcing";
import { AccountId } from "./account-id";

export class Deposited extends Event({
  accountId: AccountId,
  amount: Number,
}) {}
