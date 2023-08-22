import { Serializer, Store } from "@ddd-ts/model";
import { InMemoryDatabase, InMemoryTransactionId } from "./in-memory.database";
import { InMemoryTransaction } from "../in-memory.transaction";
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

  protected async filter(
    predicate: (model: Model) => boolean,
    trx?: InMemoryTransactionId
  ): Promise<Model[]> {
    const serialized = await this.database.loadAll(this.collection, trx);

    const all = await Promise.all(
      serialized.map((s) => this.serializer.deserialize(s))
    );

    return all.filter(predicate);
  }

  clear() {
    this.database.clear(this.collection);
  }

  async save(model: Model, trx?: InMemoryTransaction): Promise<void> {
    await this.database.save(
      this.collection,
      this.serializer.getIdFromModel(model).toString(),
      await this.serializer.serialize(model),
      trx?.transaction
    );
  }

  async load(id: Id, trx?: InMemoryTransaction): Promise<Model | undefined> {
    const serialized = await this.database.load(
      this.collection,
      id.toString(),
      trx?.transaction
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
