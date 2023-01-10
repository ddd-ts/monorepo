import { AbstractConstructor } from "@ddd-ts/event-sourcing/dist/es-aggregate-store/event-store/event-store";
import { ISerializer } from "@ddd-ts/event-sourcing/dist/model/serializer";
import { Store } from "@ddd-ts/event-sourcing/dist/model/store";
import { InMemoryDatabase, InMemoryTransaction } from "./in-memory.database";

/**
 * This in memory store is a copy store. It stores a copy of the actual model.
 * It is the recommended inmemory store to use, as it reflects more closely the behaviour of a real store.
 */
export function InMemoryStore<
  Model,
  Id extends { toString(): string },
  Serialized extends Record<string, unknown> & { id: string }
>(
  serializer: ISerializer<Model, Id, Serialized>,
  collection: string
): AbstractConstructor<Store<Model, Id>, [InMemoryDatabase]> {
  abstract class InMemoryStore implements Store<Model, Id> {
    _storage = new Map<string, Serialized>();
    _serializer: ISerializer<Model, Id, Serialized>;

    constructor(public readonly database: InMemoryDatabase) {
      this._serializer = serializer;
    }

    clear() {
      this.database.clear(collection);
    }

    async save(model: Model, trx?: InMemoryTransaction): Promise<void> {
      const serialized = serializer.serialize(model);
      await this.database.save(
        collection,
        serialized.id,
        serializer.serialize(model),
        trx
      );
    }

    async load(id: Id, trx?: InMemoryTransaction): Promise<Model | undefined> {
      const serialized = await this.database.load(
        collection,
        id.toString(),
        trx
      );

      if (!serialized) {
        return undefined;
      }

      return serializer.deserialize(serialized);
    }

    loadAll(): Promise<Model[]> {
      const serialized = this.database.loadAll(collection);

      return Promise.resolve(serialized.map((s) => serializer.deserialize(s)));
    }

    async delete(id: Id): Promise<void> {
      this.database.delete(collection, id.toString());
    }
  }

  return InMemoryStore;
}
