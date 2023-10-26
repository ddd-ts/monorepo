import { Store, Model } from "@ddd-ts/model";
import { InMemoryDatabase, InMemoryTransactionId } from "./in-memory.database";
import { InMemoryTransaction } from "../in-memory.transaction";
import { ISerializer } from "@ddd-ts/serialization";
/**
 * This in memory store is a copy store. It stores a copy of the actual model.
 * It is the recommended inmemory store to use, as it reflects more closely the behaviour of a real store.
 */
export class InMemoryStore<M extends Model>
  implements Store<M>
{
  constructor(
    public readonly collection: string,
    public readonly database: InMemoryDatabase,
    public readonly serializer: ISerializer<M>
  ) { }

  private getIdFromModel(m: Model) {
    if (Object.getOwnPropertyNames(m.id).includes('serialize')) {
      if ('serialize' in m.id) {
        return m.id.serialize()
      }
    }
    return m.id.toString()
  }

  protected async filter(
    predicate: (model: M) => boolean,
    trx?: InMemoryTransactionId
  ): Promise<M[]> {
    const serialized = await this.database.loadAll(this.collection, trx);

    const all = await Promise.all(
      serialized.map((s) => this.serializer.deserialize(s))
    );

    return all.filter(predicate);
  }

  clear() {
    this.database.clear(this.collection);
  }

  async save(model: M, trx?: InMemoryTransaction): Promise<void> {
    await this.database.save(
      this.collection,
      this.getIdFromModel(model),
      await this.serializer.serialize(model),
      trx?.transaction
    );
  }

  async load(id: M['id'], trx?: InMemoryTransaction): Promise<M | undefined> {
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

  loadAll(): Promise<M[]> {
    const serialized = this.database.loadAll(this.collection);

    return Promise.all(serialized.map((s) => this.serializer.deserialize(s)));
  }

  async delete(id: M['id']): Promise<void> {
    this.database.delete(this.collection, id.toString());
  }
}
