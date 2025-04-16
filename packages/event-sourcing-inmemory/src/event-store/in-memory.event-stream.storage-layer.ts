import {
  StreamId,
  type ISerializedChange,
  type ISerializedFact,
  EventReference,
  EventStreamStorageLayer,
  EventId,
  ConcurrencyError,
} from "@ddd-ts/core";
import { InMemoryDatabase, InMemoryTransaction } from "@ddd-ts/store-inmemory";

export class InMemoryEventStreamStorageLayer
  implements EventStreamStorageLayer
{
  constructor(public readonly database: InMemoryDatabase) {}

  async append(
    streamId: StreamId,
    changes: ISerializedChange[],
    expectedRevision: number,
    trx: InMemoryTransaction,
  ) {
    const refs: EventReference[] = [];

    if (expectedRevision === -1) {
      const undesired = this.database.load(
        streamId.serialize(),
        `${expectedRevision}`,
        trx.transaction,
      );
      if (undesired) {
        throw new ConcurrencyError(
          `Expected revision ${expectedRevision} already exists for stream ${streamId.serialize()}`,
        );
      }
    } else {
      const expected = this.database.load(
        streamId.serialize(),
        `${expectedRevision}`,
        trx.transaction,
      );

      if (!expected) {
        throw new Error(
          `Expected revision ${expectedRevision} not found for stream ${streamId.serialize()}`,
        );
      }

      const next = this.database.load(
        streamId.serialize(),
        `${expectedRevision + 1}`,
        trx.transaction,
      );

      if (next) {
        throw new ConcurrencyError(
          `Expected revision ${expectedRevision + 1} already exists for stream ${streamId.serialize()}`,
        );
      }
    }

    let revision = expectedRevision + 1;

    for (const change of changes) {
      const ref = new EventReference(
        `${streamId.serialize()}/${change.revision}`,
      );

      const stored = {
        ...change,
        ref: ref.serialize(),
        revision: revision,
      };

      this.database.save(
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
