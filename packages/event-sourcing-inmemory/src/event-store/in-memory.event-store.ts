import {
  ConcurrencyError,
  type AggregateStreamId,
  type IChange,
} from "@ddd-ts/core";
import { Stream } from "./stream";
import type { InMemoryTransaction } from "@ddd-ts/store-inmemory";

export class InMemoryEventStore {
  private streams = new Map<string, Stream>();

  async close() {
    this.clear();
  }

  async clear() {
    this.streams.clear();
  }

  async bulkAppend(
    toAppend: {
      streamId: AggregateStreamId;
      changes: IChange[];
      expectedRevision: number;
    }[],
    trx?: InMemoryTransaction,
  ) {
    for (const { streamId, changes, expectedRevision } of toAppend) {
      await this.append(streamId, changes, expectedRevision);
    }
  }

  async append(
    streamId: AggregateStreamId,
    changes: IChange[],
    expectedRevision: number,
    trx?: InMemoryTransaction,
  ) {
    const streamName = `${streamId.aggregate}-${streamId.id}`;

    if (!this.streams.has(streamName)) {
      const stream = new Stream();
      this.streams.set(streamName, stream);
    }

    const stream = this.streams.get(streamName)!;

    const currentRevision = stream.facts.length - 1;
    if (currentRevision !== Number(expectedRevision)) {
      throw new ConcurrencyError(
        `Expected revision ${expectedRevision}, but got ${currentRevision}`,
      );
    }

    for (const change of changes) {
      stream.append(change);
    }
  }

  async *read(streamId: AggregateStreamId, from = 0) {
    const streamName = `${streamId.aggregate}-${streamId.id}`;

    const stream = this.streams.get(streamName);
    if (!stream) {
      return;
    }

    yield* stream.read(from);
  }
}
