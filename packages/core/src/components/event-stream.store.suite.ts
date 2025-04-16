import { Primitive } from "@ddd-ts/shape";
import { EsEvent } from "../makers/es-event";
import { SerializerRegistry } from "./serializer-registry";
import { TransactionPerformer } from "./transaction";
import {
  EventStreamStorageLayer,
  EventStreamStore,
} from "./event-stream.store";
import { StreamId } from "./stream-id";
import { EventId } from "./event-id";
import { buffer } from "../tools/iterator";

export function EventStreamStoreSuite(config: {
  transaction: TransactionPerformer;
  streamStorageLayer: EventStreamStorageLayer;
}) {
  const { transaction, streamStorageLayer } = config;

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

  class Deposited extends EsEvent("Deposited", {
    id: AccountId,
    amount: Number,
  }) {}

  class Withdrawn extends EsEvent("Withdrawn", {
    id: AccountId,
    amount: Number,
  }) {}

  const registry = new SerializerRegistry().auto(Deposited).auto(Withdrawn);

  const streamStore = new EventStreamStore(streamStorageLayer, registry);
  it("should append and read events", async () => {
    const streamId = StreamId.from("Bank", BankId.generate().serialize());
    const accountId = AccountId.generate();

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
    const streamId = StreamId.from("Bank", BankId.generate().serialize());
    const accountId = AccountId.generate();

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
}
