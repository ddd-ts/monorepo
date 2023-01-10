// type Collection = Map<string, any>;
// type Storage = Map<string, Collection>;

import { Storage } from "./in-memory.storage";

export type InMemoryTransaction = string;

export class InMemoryDatabase {
  private storage = new Storage();
  private transactions = new Map<InMemoryTransaction, Storage>();

  getStorage(trx?: InMemoryTransaction) {
    if (trx) {
      const storage = this.transactions.get(trx);
      if (!storage) {
        throw new Error(`Transaction "${trx}" not found`);
      }
      return storage;
    }
    return this.storage;
  }

  clear(collectionName: string) {
    this.storage.getCollection(collectionName).clear();
  }

  load(collectionName: string, id: string, trx?: InMemoryTransaction): any {
    return this.getStorage(trx).getCollection(collectionName).get(id);
  }

  delete(collectionName: string, id: string): void {
    // TODO: implement transactional delete
    this.storage.getCollection(collectionName).delete(id);
  }

  loadAll(collectionName: string, trx?: InMemoryTransaction): any[] {
    return this.getStorage(trx).getCollection(collectionName).getAll();
  }

  save(
    collectionName: string,
    id: string,
    data: any,
    trx?: InMemoryTransaction
  ): void {
    const globalStorage = this.storage;
    const targetStorage = this.getStorage(trx);

    if (
      globalStorage.getCollection(collectionName).get(id) !==
      targetStorage.getCollection(collectionName).get(id)
    ) {
      throw new Error(`Write collision detected for key "${id}"`);
    }

    targetStorage.getCollection(collectionName).save(id, data);
  }

  async transactionally(fn: (trx: InMemoryTransaction) => any) {
    let trx = Math.random().toString().substring(2);
    const snapshot = this.storage.clone();

    this.transactions.set(trx, snapshot);

    let retry = 5;
    let latestReturnValue = undefined;
    while (retry--) {
      try {
        latestReturnValue = await fn(trx);
        this.commit(trx);
        break;
      } catch (error) {
        console.error(error);
        this.transactions.set(trx, this.storage.clone());
      }
    }

    if (retry === -1) {
      throw new Error("failed to execute transaction after 5 retries");
    }

    return latestReturnValue;
  }

  private commit(trx: InMemoryTransaction): void {
    const snapshot = this.transactions.get(trx);
    if (!snapshot) {
      throw new Error(`Transaction "${trx}" not found`);
    }

    this.storage = this.storage.clone().merge(snapshot);
    this.transactions.delete(trx);
  }

  print() {
    console.log(
      [
        "Database:",
        this.storage.toPretty(),
        "",
        "Transactions:",
        ...[...this.transactions.entries()].map(
          ([trx, storage]) => `\t${trx}: ${storage.toPretty()}`
        ),
      ].join("\n")
    );
  }
}
