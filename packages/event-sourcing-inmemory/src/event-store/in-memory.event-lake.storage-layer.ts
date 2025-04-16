import {
  LakeId,
  type ISerializedChange,
  type ISerializedFact,
  EventReference,
  EventLakeStorageLayer,
  EventId,
} from "@ddd-ts/core";
import { InMemoryDatabase, InMemoryTransaction } from "@ddd-ts/store-inmemory";

export class InMemoryEventLakeStorageLayer implements EventLakeStorageLayer {
  constructor(public readonly database: InMemoryDatabase) {}

  async append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: InMemoryTransaction,
  ) {
    const refs: EventReference[] = [];

    let revision = 0;
    for (const change of changes) {
      const ref = new EventReference(`${lakeId.serialize()}/${change.id}`);

      const stored = {
        ...change,
        ref: ref.serialize(),
        revision: revision,
      };

      this.database.save(
        lakeId.serialize(),
        change.id,
        stored,
        trx.transaction,
      );
      refs.push(ref);
      revision++;
    }
    return refs;
  }

  async *read(
    lakeId: LakeId,
    startAfter?: EventId,
    endAt?: EventId,
  ): AsyncIterable<ISerializedFact> {
    const events = this.database.loadAll(lakeId.serialize());

    const sorted = events.sort((a, b) =>
      a.data.savedAt === b.data.savedAt
        ? a.data.data.revision - b.data.data.revision
        : a.data.savedAt < b.data.savedAt
          ? -1
          : 1,
    );

    const facts = sorted.map((e) => e.data.data);

    let started = !startAfter;

    for (const fact of facts) {
      if (startAfter && fact.id === startAfter.serialize()) {
        started = true;
        continue;
      }
      if (endAt && fact.id === endAt.serialize()) {
        yield fact;
        break;
      }
      if (started) {
        yield fact;
      }
    }
  }
}
