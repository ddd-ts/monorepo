import {
  ConcurrencyError,
  type StreamId,
  type IChange,
  ISerializedChange,
  EventReference,
} from "@ddd-ts/core";
import type { InMemoryTransaction } from "@ddd-ts/store-inmemory";
import { Stream } from "./stream";
import { IEventStreamStore } from "@ddd-ts/core";

export class InMemoryEventStreamStore implements IEventStreamStore {
  private streams = new Map<string, Stream>();

  async close() {
    this.clear();
  }

  async clear() {
    this.streams.clear();
  }

  async append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: InMemoryTransaction,
  ) {

    if (!this.streams.has(streamId.serialize())) {
      const stream = new Stream(streamId);
      this.streams.set(streamId.serialize(), stream);
    }

    const stream = this.streams.get(streamId.serialize())!;

    const currentRevision = stream.facts.length - 1;
    if (currentRevision !== Number(expectedRevision)) {
      throw new ConcurrencyError(
        `Expected revision ${expectedRevision}, but got ${currentRevision}`,
      );
    }

    const refs: EventReference[] = [];

    for (const change of changes) {
      const ref = stream.append(change);
      refs.push(new EventReference(ref));
    }

    return refs;
  }

  async *read(streamId: StreamId, from = 0) {
    const stream = this.streams.get(streamId.serialize());
    if (!stream) {
      return;
    }

    yield* stream.read(from);
  }
}
