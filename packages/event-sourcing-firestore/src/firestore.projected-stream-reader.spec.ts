process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";

import {
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { FirestoreEventLakeStore } from "./firestore.event-lake-store";
import { Primitive } from "@ddd-ts/shape";
import { buffer, EsEvent, EventId, LakeId, StreamId } from "@ddd-ts/core";
import { FirestoreEventStreamStore } from "./firestore.event-stream-store";
import { FirestoreProjectedStreamReader, LakeSource, ProjectedStream, StreamSource } from "./firestore.projected-stream-reader";

jest.setTimeout(10000);

describe("FirestoreProjectedStreamStore", () => {
  const app = fb.initializeApp({
    projectId: "demo-es",
  });
  const firestore = app.firestore();

  const transaction = new FirestoreTransactionPerformer(firestore);
  const lakeStore = new FirestoreEventLakeStore(firestore);
  const streamStore = new FirestoreEventStreamStore(firestore);

  const projectedStreamReader = new FirestoreProjectedStreamReader(firestore);
  
  class AccountId extends Primitive(String) {
    static generate(){
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

  function appendToLake(lakeId: LakeId, events: (Added | Removed | Multiplied)[]) {
    return transaction.perform((trx) => lakeStore.append(lakeId, events.map(e => e.serializeChange()), trx));
  }

   function appendToStream(streamId: StreamId, expectedRevision: number, events: (Added | Removed | Multiplied)[]) {
    return transaction.perform((trx) => streamStore.append(streamId, events.map(e => e.serializeChange()), expectedRevision, trx));
  }
  
  it('should read events in order', async () => {

    const accountId = AccountId.generate();

    const lakeId = LakeId.from("Bank", EventId.generate().serialize().slice(0, 8));
    const streamId = StreamId.from('Account', accountId.serialize());

    await appendToStream(streamId, -1, [
      Added.new({ id: accountId, amount: 20 }),
      Added.new({ id: accountId, amount: 30 }),
    ]);

    await appendToLake(lakeId, [
      Removed.new({ id: accountId, amount: 10 }),
      Removed.new({ id: accountId, amount: 20 }),
    ]);

    await appendToLake(lakeId, [
      Multiplied.new({ id: accountId, factor: 2 }),
    ]);

    await appendToStream(streamId, 1, [
      Added.new({ id: accountId, amount: 50 }),
      Multiplied.new({ id: accountId, factor: 3 }),
    ]);

    const result = await buffer(projectedStreamReader.read(new ProjectedStream([
      new StreamSource({
        aggregateType: "Account",
        shardKey: "id",
        events: [Added.name, Removed.name, Multiplied.name],
      }),
      new LakeSource({
        shardType: "Bank",
        shardKey: "id",
        events: [Added.name, Removed.name, Multiplied.name],
      })
    ]), accountId.serialize()));

    expect(result.map(e => `${e.name}:${e.payload.amount ?? e.payload.factor}`)).toEqual([
      "Added:20",
      "Added:30",
      "Removed:10",
      "Removed:20",
      "Multiplied:2",
      "Added:50",
      "Multiplied:3",
    ]);
  })

  it('should read events in order with startAfter and endAt', async () => {
    const accountId = AccountId.generate();

    const lakeId = LakeId.from("Bank", EventId.generate().serialize().slice(0, 8));
    const streamId = StreamId.from('Account', accountId.serialize());

    const [start] = await appendToStream(streamId, -1, [
      Added.new({ id: accountId, amount: 20 }),
      Added.new({ id: accountId, amount: 30 }),
    ]);

    await appendToLake(lakeId, [
      Removed.new({ id: accountId, amount: 10 }),
      Removed.new({ id: accountId, amount: 20 }),
    ]);

    await appendToLake(lakeId, [
      Multiplied.new({ id: accountId, factor: 2 }),
    ]);

    const [end,] = await appendToStream(streamId, 1, [
      Added.new({ id: accountId, amount: 50 }),
      Multiplied.new({ id: accountId, factor: 3 }),
    ]);

    const result = await buffer(projectedStreamReader.read(new ProjectedStream([
      new StreamSource({
        aggregateType: "Account",
        shardKey: "id",
        events: [Added.name, Removed.name, Multiplied.name],
      }),
      new LakeSource({
        shardType: "Bank",
        shardKey: "id",
        events: [Added.name, Removed.name, Multiplied.name],
      })
    ]), accountId.serialize(), start, end));

    expect(result.map(e => `${e.name}:${e.payload.amount ?? e.payload.factor}`)).toEqual([
      "Added:30",
      "Removed:10",
      "Removed:20",
      "Multiplied:2",
      "Added:50",
    ]);
  })

});
