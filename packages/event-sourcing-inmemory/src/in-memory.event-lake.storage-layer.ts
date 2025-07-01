import {
  LakeId,
  type ISerializedChange,
  type ISerializedFact,
  EventLakeStorageLayer,
  EventId,
} from "@ddd-ts/core";
import { ISerializedSavedChange } from "@ddd-ts/core/dist/interfaces/es-event";
import { InMemoryDatabase, InMemoryTransaction } from "@ddd-ts/store-inmemory";

export class InMemoryEventLakeStorageLayer implements EventLakeStorageLayer {
  constructor(public readonly database: InMemoryDatabase) {}

  async append(
    lakeId: LakeId,
    changes: ISerializedChange[],
    trx: InMemoryTransaction,
  ) {
    const result: ISerializedSavedChange[] = [];

    let revision = 0;
    for (const change of changes) {
      const ref = `${lakeId.serialize()}/${change.id}`;

      const stored = {
        ...change,
        ref: ref,
        revision: revision,
      };

      this.database.save(
        lakeId.serialize(),
        change.id,
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

    const facts = sorted.map((e) => e.data);

    let started = !startAfter;

    for (const fact of facts) {
      if (startAfter && fact.data.id === startAfter.serialize()) {
        started = true;
        continue;
      }
      if (endAt && fact.data.id === endAt.serialize()) {
        yield { ...fact.data, occurredAt: fact.data.savedAt };
        break;
      }
      if (started) {
        yield { ...fact.data, occurredAt: fact.data.savedAt };
      }
    }
  }
}
