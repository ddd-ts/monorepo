import { IEventBus, SerializerRegistry } from "@ddd-ts/core";
import {
  Account,
  AccountOpened,
  AccountRegistered,
  AccountRenamed,
  AccountUnregistered,
  Bank,
  BankCreated,
  Deposited,
  Withdrawn,
} from "./write";
import { MakeFirestoreEventStreamAggregateStore } from "../firestore.event-stream.aggregate-store";
import { Firestore } from "firebase-admin/firestore";

export const registry = new SerializerRegistry()
  .auto(AccountOpened)
  .auto(Deposited)
  .auto(Withdrawn)
  .auto(AccountRenamed)
  .auto(BankCreated)
  .auto(AccountRegistered)
  .auto(AccountUnregistered)
  .auto(Account)
  .auto(Bank);

export class AccountStore extends MakeFirestoreEventStreamAggregateStore(
  Account,
) {
  constructor(firestore: Firestore, eventBus?: IEventBus) {
    super(firestore, registry, eventBus);
  }
}
