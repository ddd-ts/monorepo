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
    const filtered = await Promise.all(
      this.database.loadAll(this.collection).map(async (e) => {
        const deserialized = await this.serializer.deserialize(e.data.data);
        if (!predicate(deserialized)) {
          return undefined;
        }
        trx?.transaction.markRead(this.collection, e.id, e.data.savedAt);
        return deserialized;
      })
    );
    return filtered.filter((e): e is NonNullable<typeof e> => Boolean(e));
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
    const serialized = this.database.loadAll(this.collection);

    return Promise.all(
      serialized.map(async (s) => {
        trx?.transaction.markRead(this.collection, s.id, s.data.savedAt);
        return this.serializer.deserialize(s.data.data);
      })
    );
  }

  async loadMany(ids: M["id"][], trx?: InMemoryTransaction): Promise<M[]> {
    const result = await Promise.all(ids.map((id) => this.load(id, trx)));
    return result.filter((m) => m !== undefined) as M[];
  }

  async delete(id: M["id"], trx?: InMemoryTransaction): Promise<void> {
    this.database.delete(this.collection, id.toString(), trx?.transaction);
  }

  async countAll() {
    return this.database.countAll(this.collection);
  }

  async *streamAll(): AsyncIterable<M> {
    for (const item of await this.filter(() => true)) {
      yield item;
    }
  }
}
