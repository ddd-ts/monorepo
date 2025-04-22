import {
  StreamId,
  type ISerializedChange,
  type ISerializedFact,
  EventReference,
  EventStreamStorageLayer,
  ConcurrencyError,
} from "@ddd-ts/core";
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
    const refs: EventReference[] = [];

    let revision = expectedRevision + 1;

    for (const change of changes) {
      const ref = new EventReference(`${streamId.serialize()}/${revision}`);

      const stored = {
        ...change,
        ref: ref.serialize(),
        revision: revision,
      };

      this.database.create(
        streamId.serialize(),
        `${revision}`,
        stored,
        trx.transaction,
      );

      refs.push(ref);
      revision++;
    }
    return refs;
  }

  async *read(
    streamId: StreamId,
    from?: number,
  ): AsyncIterable<ISerializedFact> {
    const events = this.database.loadAll(streamId.serialize());

    const sorted = events.sort(
      (a, b) => a.data.data.revision - b.data.data.revision,
    );

    const facts = sorted.map((e) => e.data.data);

    yield* facts.slice(from !== undefined ? from : 0);
  }
}
