import {
  ISerializedChange,
  LakeId,
  EventId,
} from "@ddd-ts/core";
import type { InMemoryTransaction } from "@ddd-ts/store-inmemory";
import { Stream } from "./stream";

export class InMemoryEventLakeStore {
  private streams = new Map<string, Stream>();

  async close() {
    this.clear();
  }

  async clear() {
    this.streams.clear();
  }

  async append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: InMemoryTransaction,
  ) {
    if (!this.streams.has(lakeId.serialize())) {
      const stream = new Stream();
      this.streams.set(lakeId.serialize(), stream);
    }

    const stream = this.streams.get(lakeId.serialize())!;

    for (const change of changes) {
      stream.append(change);
    }
  }

  async *read(streamId: LakeId, startAfter?: EventId, endAt?: EventId) {
    const stream = this.streams.get(streamId.serialize());
    if (!stream) {
      return;
    }

    yield* stream.readLake(startAfter, endAt);
  }
}
