import { Serializer, Store } from "@ddd-ts/model";
import { InMemoryDatabase, InMemoryTransaction } from "./in-memory.database";
/**
 * This in memory store is a copy store. It stores a copy of the actual model.
 * It is the recommended inmemory store to use, as it reflects more closely the behaviour of a real store.
 */
export class InMemoryStore<Model, Id extends { toString(): string }>
  implements Store<Model, Id>
{
  constructor(
    public readonly collection: string,
    public readonly database: InMemoryDatabase,
    public readonly serializer: Serializer<Model>
  ) {}

  clear() {
    this.database.clear(this.collection);
  }

  async save(model: Model, trx?: InMemoryTransaction): Promise<void> {
    await this.database.save(
      this.collection,
      this.serializer.getIdFromModel(model).toString(),
      await this.serializer.serialize(model),
      trx
    );
  }

  async load(id: Id, trx?: InMemoryTransaction): Promise<Model | undefined> {
    const serialized = await this.database.load(
      this.collection,
      id.toString(),
      trx
    );

    if (!serialized) {
      return undefined;
    }

    return this.serializer.deserialize(serialized);
  }

  loadAll(): Promise<Model[]> {
    const serialized = this.database.loadAll(this.collection);

    return Promise.all(serialized.map((s) => this.serializer.deserialize(s)));
  }

  async delete(id: Id): Promise<void> {
    this.database.delete(this.collection, id.toString());
  }
}
