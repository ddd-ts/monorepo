import { Store, Model } from "@ddd-ts/model";
import { InMemoryDatabase } from "./in-memory.database";
import { InMemoryTransaction } from "../in-memory.transaction";
import { ISerializer, PromiseOr } from "@ddd-ts/serialization";
/**
 * This in memory store is a copy store. It stores a copy of the actual model.
 * It is the recommended inmemory store to use, as it reflects more closely the behaviour of a real store.
 */
export class InMemoryStore<M extends Model> implements Store<M> {
  constructor(
    public readonly collection: string,
    public readonly database: InMemoryDatabase,
    public readonly serializer: ISerializer<M>
  ) {}

  private serializeId(id: M["id"]) {
    if (Object.getOwnPropertyNames(id).includes("serialize")) {
      if ("serialize" in id) {
        return id.serialize();
      }
    }
    return id.toString();
  }

  protected async filter(
    predicate: (model: M) => boolean,
    trx?: InMemoryTransaction
  ): Promise<M[]> {
    return Promise.all(
      (
        await this.database.loadFiltered(
          this.collection,
          async (item) => predicate(await this.serializer.deserialize(item)),
          trx?.transaction
        )
      ).map((e) => this.serializer.deserialize(e.data.data))
    );
  }

  clear() {
    this.database.clear(this.collection);
  }

  async save(model: M, trx?: InMemoryTransaction): Promise<void> {
    await this.database.save(
      this.collection,
      this.serializeId(model.id),
      await this.serializer.serialize(model),
      trx?.transaction
    );
  }

  async load(id: M["id"], trx?: InMemoryTransaction): Promise<M | undefined> {
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

  loadAll(trx?: InMemoryTransaction): Promise<M[]> {
    const serialized = this.database.loadAll(this.collection, trx?.transaction);

    return Promise.all(serialized.map((s) => this.serializer.deserialize(s)));
  }

  async loadMany(ids: M["id"][], trx?: InMemoryTransaction): Promise<M[]> {
    const result = await Promise.all(ids.map((id) => this.load(id, trx)));
    return result.filter((m) => m !== undefined) as M[];
  }

  async delete(id: M["id"], trx?: InMemoryTransaction): Promise<void> {
    this.database.delete(this.collection, id.toString(), trx?.transaction);
  }

  async *streamAll(): AsyncIterable<M> {
    for (const item of await this.filter(() => true)) {
      yield item;
    }
  }
}
