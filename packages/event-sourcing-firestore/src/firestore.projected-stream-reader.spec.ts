process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import {
  FirestoreEventLakeStore,
  FirestoreSerializedEventLakeStore,
} from "./firestore.event-lake-store";
import { Primitive } from "@ddd-ts/shape";
import {
  buffer,
  EsEvent,
  EventId,
  IChange,
  LakeId,
  SerializerRegistry,
  StreamId,
} from "@ddd-ts/core";
import {
  FirestoreSerializedEventStreamStore,
  FirestoreEventStreamStore,
} from "./firestore.event-stream-store";
import {
  FirestoreProjectedStreamReader,
  FirestoreSerializedProjectedStreamReader,
  LakeSource,
  ProjectedStream,
  StreamSource,
} from "./firestore.projected-stream-reader";

jest.setTimeout(10000);

describe("FirestoreProjectedStreamStore", () => {
  const app = fb.initializeApp({
    projectId: "demo-es",
  });
  const firestore = app.firestore();

  class AccountId extends Primitive(String) {
    static generate() {
      return new AccountId(EventId.generate().serialize());
    }
  }
  class Added extends EsEvent("Added", {
    id: AccountId,
    amount: Number,
  }) {}

  class Removed extends EsEvent("Removed", {
    id: AccountId,
    amount: Number,
  }) {}

  class Multiplied extends EsEvent("Multiplied", {
    id: AccountId,
    factor: Number,
  }) {}

  const registry = new SerializerRegistry()
    .auto(Added)
    .auto(Removed)
    .auto(Multiplied);

  const transaction = new FirestoreTransactionPerformer(firestore);

  const lakeStore = new FirestoreEventLakeStore(
    new FirestoreSerializedEventLakeStore(firestore),
    registry,
  );

  const streamStore = new FirestoreEventStreamStore(
    new FirestoreSerializedEventStreamStore(firestore),
    registry,
  );

  const projectedStreamReader = new FirestoreProjectedStreamReader(
    new FirestoreSerializedProjectedStreamReader(firestore),
    registry,
  );

  function appendToLake(
    lakeId: LakeId,
    events: (IChange<Added> | IChange<Removed> | IChange<Multiplied>)[],
  ) {
    return transaction.perform((trx) => lakeStore.append(lakeId, events, trx));
  }

  function appendToStream(
    streamId: StreamId,
    expectedRevision: number,
    events: (IChange<Added> | IChange<Removed> | IChange<Multiplied>)[],
  ) {
    return transaction.perform((trx) =>
      streamStore.append(streamId, events, expectedRevision, trx),
    );
  }

  it("should read events in order", async () => {
    const accountId = AccountId.generate();

    const lakeId = LakeId.from(
      "Bank",
      EventId.generate().serialize().slice(0, 8),
    );
    const streamId = StreamId.from("Account", accountId.serialize());

    await appendToStream(streamId, -1, [
      Added.new({ id: accountId, amount: 20 }),
      Added.new({ id: accountId, amount: 30 }),
    ]);

    await appendToLake(lakeId, [
      Removed.new({ id: accountId, amount: 10 }),
      Removed.new({ id: accountId, amount: 20 }),
    ]);

    await appendToLake(lakeId, [Multiplied.new({ id: accountId, factor: 2 })]);

    await appendToStream(streamId, 1, [
      Added.new({ id: accountId, amount: 50 }),
      Multiplied.new({ id: accountId, factor: 3 }),
    ]);

    const result = await buffer(
      projectedStreamReader.read(
        new ProjectedStream([
          new StreamSource({
            aggregateType: "Account",
            shardKey: "id",
            events: [Added.name, Removed.name, Multiplied.name],
          }),
          new LakeSource({
            shardType: "Bank",
            shardKey: "id",
            events: [Added.name, Removed.name, Multiplied.name],
          }),
        ]),
        accountId.serialize(),
      ),
    );

    expect(
      result.map(
        (e) =>
          `${e.name}:${"amount" in e.payload ? e.payload.amount : e.payload.factor}`,
      ),
    ).toEqual([
      "Added:20",
      "Added:30",
      "Removed:10",
      "Removed:20",
      "Multiplied:2",
      "Added:50",
      "Multiplied:3",
    ]);
  });

  it("should read events in order with startAfter and endAt", async () => {
    const accountId = AccountId.generate();

    const lakeId = LakeId.from(
      "Bank",
      EventId.generate().serialize().slice(0, 8),
    );
    const streamId = StreamId.from("Account", accountId.serialize());

    const [start] = await appendToStream(streamId, -1, [
      Added.new({ id: accountId, amount: 20 }),
      Added.new({ id: accountId, amount: 30 }),
    ]);

    await appendToLake(lakeId, [
      Removed.new({ id: accountId, amount: 10 }),
      Removed.new({ id: accountId, amount: 20 }),
    ]);

    await appendToLake(lakeId, [Multiplied.new({ id: accountId, factor: 2 })]);

    const [end] = await appendToStream(streamId, 1, [
      Added.new({ id: accountId, amount: 50 }),
      Multiplied.new({ id: accountId, factor: 3 }),
    ]);

    const result = await buffer(
      projectedStreamReader.read(
        new ProjectedStream([
          new StreamSource({
            aggregateType: "Account",
            shardKey: "id",
            events: [Added.name, Removed.name, Multiplied.name],
          }),
          new LakeSource({
            shardType: "Bank",
            shardKey: "id",
            events: [Added.name, Removed.name, Multiplied.name],
          }),
        ]),
        accountId.serialize(),
        start,
        end,
      ),
    );

    expect(
      result.map(
        (e) =>
          `${e.name}:${"amount" in e.payload ? e.payload.amount : e.payload.factor}`,
      ),
    ).toEqual([
      "Added:30",
      "Removed:10",
      "Removed:20",
      "Multiplied:2",
      "Added:50",
    ]);
  });
});
