import { Primitive } from "@ddd-ts/shape";
import { EventId } from "./event-id";
import { EsEvent } from "../makers/es-event";
import { SerializerRegistry } from "./serializer-registry";
import { TransactionPerformer } from "./transaction";
import {
  LakeSource,
  ProjectedStream,
  ProjectedStreamReader,
  ProjectedStreamStorageLayer,
  StreamSource,
} from "./projected-stream";
import {
  EventStreamStorageLayer,
  EventStreamStore,
} from "./event-stream.store";
import { EventLakeStorageLayer, EventLakeStore } from "./event-lake.store";
import { LakeId, StreamId } from "./stream-id";
import { IChange } from "../interfaces/es-event";
import { buffer } from "../tools/iterator";

export function ProjectedStreamReaderSuite(config: {
  transaction: TransactionPerformer;
  lakeStorageLayer: EventLakeStorageLayer;
  streamStorageLayer: EventStreamStorageLayer;
  readerStorageLayer: ProjectedStreamStorageLayer;
}) {
  class AccountId extends Primitive(String) {
    static generate() {
      return new AccountId(`A${EventId.generate().serialize().slice(0, 8)}`);
    }
  }

  class BankId extends Primitive(String) {
    static generate() {
      return new BankId(`B${EventId.generate().serialize().slice(0, 8)}`);
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

  const transaction = config.transaction;
  const lakeStore = new EventLakeStore(config.lakeStorageLayer, registry);
  const streamStore = new EventStreamStore(config.streamStorageLayer, registry);
  const reader = new ProjectedStreamReader(config.readerStorageLayer, registry);

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
    const lakeId = LakeId.from("Bank", BankId.generate().serialize());

    const accountId = AccountId.generate();

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

    const projectedStream = new ProjectedStream({
      sources: [
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
      ],
    });

    const result = await buffer(
      reader.read(projectedStream, accountId.serialize()),
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
    const lakeId = LakeId.from("Bank", BankId.generate().serialize());
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

    const projectedStream = new ProjectedStream({
      sources: [
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
      ],
    });

    const result = await buffer(
      reader.read(projectedStream, accountId.serialize(), start, end),
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
}
