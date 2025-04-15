import { Primitive } from "@ddd-ts/shape";
import {
  buffer,
  EsEvent,
  EventId,
  LakeId,
} from "@ddd-ts/core";

import {
  InMemoryDatabase,
  InMemoryTransactionPerformer,
} from "@ddd-ts/store-inmemory";

import { InMemoryEventLakeStore } from "./in-memory.event-lake-store";

describe("InMemoryEventLakeStore", () => {
  const database = new InMemoryDatabase();

  const transaction = new InMemoryTransactionPerformer(database);
  const lakeStore = new InMemoryEventLakeStore();
  
  class AccountId extends Primitive(String) {}

  class Deposited extends EsEvent("Deposited", {
    id: AccountId,
    amount: Number,
  }) {}

  class Withdrawn extends EsEvent("Withdrawn", {
    id: AccountId,
    amount: Number,
  }) {}

  it('should append and read events', async () => {
    const lakeId = LakeId.from("Bank", EventId.generate().serialize().slice(0, 8));

    const accountId = new AccountId("123");
    const events = [
      Deposited.new({ id: accountId, amount: 100 }),
      Withdrawn.new({ id: accountId, amount: 1 }),
      Withdrawn.new({ id: accountId, amount: 2 }),
      Withdrawn.new({ id: accountId, amount: 3 }),
    ].map(e => e.serializeChange());


    await transaction.perform((trx) => lakeStore.append(lakeId, events, trx));

    const result = await buffer(lakeStore.read(lakeId));

    expect(result.map(e => `${e.name}:${e.payload.amount}`)).toEqual([
      "Deposited:100",
      "Withdrawn:1",
      "Withdrawn:2",
      "Withdrawn:3",
    ]);
  })

  it('should read events in the correct order, within and across transactions', async () => {
    const lakeId = LakeId.from("Bank", EventId.generate().serialize().slice(0, 8));

    const accountId = new AccountId("123");

    const events = [
      Deposited.new({ id: accountId, amount: 100 }),
      Withdrawn.new({ id: accountId, amount: 1 }),
      Withdrawn.new({ id: accountId, amount: 2 }),
      Withdrawn.new({ id: accountId, amount: 3 }),
    ].map(e => e.serializeChange());
    
    
    await transaction.perform(async (trx) => {
      lakeStore.append(lakeId, [events[0], events[1]], trx);
    });

    await transaction.perform(async (trx) => {
      lakeStore.append(lakeId, [events[2], events[3]], trx);
    });

    const result = await buffer(lakeStore.read(lakeId));

    expect(result.map(e => `${e.name}:${e.payload.amount}`)).toEqual([
      "Deposited:100",
      "Withdrawn:1",
      "Withdrawn:2",
      "Withdrawn:3",
    ]);
  });

  it('should read events with startAfter and endAt', async () => {
    const lakeId = LakeId.from("Bank", EventId.generate().serialize().slice(0, 8));

    const accountId = new AccountId("123");

    const events = [
      Deposited.new({ id: accountId, amount: 100 }),
      Withdrawn.new({ id: accountId, amount: 1 }),
      Withdrawn.new({ id: accountId, amount: 2 }),
      Withdrawn.new({ id: accountId, amount: 3 }),
    ];
    
    await transaction.perform(async (trx) => {
      lakeStore.append(lakeId, events.map(e => e.serializeChange()), trx);
    });

    const result = await buffer(lakeStore.read(lakeId, events[0].id, events[2].id));
    
    expect(result.map(e => `${e.name}:${e.payload.amount}`)).toEqual([
      "Withdrawn:1",
      "Withdrawn:2",
    ]);
  })
});
