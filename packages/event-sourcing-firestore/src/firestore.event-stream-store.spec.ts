process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import {
  FirestoreEventStreamStore,
  FirestoreSerializedEventStreamStore,
} from "./firestore.event-stream-store";
import { Primitive } from "@ddd-ts/shape";
import {
  buffer,
  EsEvent,
  EventId,
  StreamId,
  SerializerRegistry,
} from "@ddd-ts/core";

jest.setTimeout(10000);

describe("FirestoreEventStreamStore", () => {
  const app = fb.initializeApp({
    projectId: "demo-es",
  });
  const firestore = app.firestore();

  class AccountId extends Primitive(String) {}

  class Deposited extends EsEvent("Deposited", {
    id: AccountId,
    amount: Number,
  }) {}

  class Withdrawn extends EsEvent("Withdrawn", {
    id: AccountId,
    amount: Number,
  }) {}

  const registry = new SerializerRegistry().auto(Deposited).auto(Withdrawn);

  const transaction = new FirestoreTransactionPerformer(firestore);

  const streamStore = new FirestoreEventStreamStore(
    new FirestoreSerializedEventStreamStore(firestore),
    registry,
  );

  it("should append and read events", async () => {
    const streamId = StreamId.from(
      "Bank",
      EventId.generate().serialize().slice(0, 8),
    );

    const accountId = new AccountId("123");
    const events = [
      Deposited.new({ id: accountId, amount: 100 }),
      Withdrawn.new({ id: accountId, amount: 1 }),
      Withdrawn.new({ id: accountId, amount: 2 }),
      Withdrawn.new({ id: accountId, amount: 3 }),
    ];

    await transaction.perform((trx) =>
      streamStore.append(streamId, events, -1, trx),
    );

    const result = await buffer(streamStore.read(streamId));

    expect(result.map((e) => `${e.name}:${e.payload.amount}`)).toEqual([
      "Deposited:100",
      "Withdrawn:1",
      "Withdrawn:2",
      "Withdrawn:3",
    ]);
  });

  it("should read events in the correct order, within and across transactions", async () => {
    const streamId = StreamId.from(
      "Bank",
      EventId.generate().serialize().slice(0, 8),
    );

    const accountId = new AccountId("123");

    const events = [
      Deposited.new({ id: accountId, amount: 100 }),
      Withdrawn.new({ id: accountId, amount: 1 }),
      Withdrawn.new({ id: accountId, amount: 2 }),
      Withdrawn.new({ id: accountId, amount: 3 }),
    ];

    await transaction.perform(async (trx) => {
      streamStore.append(streamId, [events[0], events[1]], -1, trx);
    });

    await transaction.perform(async (trx) => {
      streamStore.append(streamId, [events[2], events[3]], 1, trx);
    });

    const result = await buffer(streamStore.read(streamId));

    expect(result.map((e) => `${e.name}:${e.payload.amount}`)).toEqual([
      "Deposited:100",
      "Withdrawn:1",
      "Withdrawn:2",
      "Withdrawn:3",
    ]);
  });
});
