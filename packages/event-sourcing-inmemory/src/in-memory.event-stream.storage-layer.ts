import {
  StreamId,
  type ISerializedChange,
  type ISerializedFact,
  type EventStreamStorageLayer,
  ConcurrencyError,
} from "@ddd-ts/core";
import type { ISerializedSavedChange } from "@ddd-ts/core/dist/interfaces/es-event";
import { InMemoryDatabase, InMemoryTransaction } from "@ddd-ts/store-inmemory";

export class InMemoryEventStreamStorageLayer
  implements EventStreamStorageLayer
{
  constructor(public readonly database: InMemoryDatabase) {}

  isLocalRevisionOutdatedError(error: unknown): boolean {
    return error instanceof ConcurrencyError;
  }

  async append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: InMemoryTransaction,
  ) {
    const result: ISerializedSavedChange[] = [];

    let revision = expectedRevision + 1;

    for (const change of changes) {
      const ref = `${streamId.serialize()}/${revision}`;

      const stored = {
        ...change,
        ref: ref,
        revision: revision,
      };

      this.database.create(
        streamId.serialize(),
        `${revision}`,
        stored,
        trx.transaction,
      );

      result.push({
        ...change,
        ref: ref,
        revision: revision,
        occurredAt: undefined,
      });

      revision++;
    }
    return result;
  }

  async *read(
    streamId: StreamId,
    from?: number,
  ): AsyncIterable<ISerializedFact> {
    const events = this.database.loadAll(streamId.serialize());

    const sorted = events.sort(
      (a, b) => a.data.data.revision - b.data.data.revision,
    );

    const facts = sorted.map((e) => ({
      ...e.data.data,
      occurredAt: e.data.savedAt,
    }));

    yield* facts.slice(from !== undefined ? from : 0);
  }
}
