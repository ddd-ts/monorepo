import { AbstractConstructor } from "@ddd-ts/event-sourcing/dist/es-aggregate-store/event-store/event-store";
import { Serializer } from "@ddd-ts/event-sourcing/dist/model/serializer";
import { Store } from "@ddd-ts/event-sourcing/dist/model/store";
import { InMemoryDatabase, InMemoryTransaction } from "./in-memory.database";

/**
 * This in memory store is a copy store. It stores a copy of the actual model.
 * It is the recommended inmemory store to use, as it reflects more closely the behaviour of a real store.
 */
export function InMemoryStore<Model, Id extends { toString(): string }>(
  collection: string
): AbstractConstructor<
  Store<Model, Id>,
  [InMemoryDatabase, Serializer<Model>]
> {
  abstract class InMemoryStore implements Store<Model, Id> {
    constructor(
      public readonly database: InMemoryDatabase,
      private readonly serializer: Serializer<Model>
    ) {}

    clear() {
      this.database.clear(collection);
    }

    async save(model: Model, trx?: InMemoryTransaction): Promise<void> {
      const serialized = this.serializer.serialize(model);
      await this.database.save(
        collection,
        serialized.id,
        this.serializer.serialize(model),
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

      return this.serializer.deserialize(serialized);
    }

    loadAll(): Promise<Model[]> {
      const serialized = this.database.loadAll(collection);

      return Promise.resolve(
        serialized.map((s) => this.serializer.deserialize(s))
      );
    }

    async delete(id: Id): Promise<void> {
      this.database.delete(collection, id.toString());
    }
  }

  return InMemoryStore;
}
