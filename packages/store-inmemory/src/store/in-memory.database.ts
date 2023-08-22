import { Storage } from "./in-memory.storage";

export type InMemoryTransactionId = string;

class TransactionNotFound extends Error {
  constructor(trx: InMemoryTransactionId) {
    super(`Transaction "${trx}" not found`);
  }
}

class WriteCollisionDetected extends Error {
  constructor(id: string) {
    super(`Write collision detected for key "${id}"`);
  }
}

export class InMemoryDatabase {
  private storage = new Storage();
  private transactions = new Map<InMemoryTransactionId, Storage>();

  getStorage(trx?: InMemoryTransactionId) {
    if (trx) {
      const storage = this.transactions.get(trx);
      if (!storage) {
        throw new TransactionNotFound(trx);
      }
      return storage;
    }
    return this.storage;
  }

  clear(collectionName: string) {
    this.storage.getCollection(collectionName).clear();
  }

  load(collectionName: string, id: string, trx?: InMemoryTransactionId): any {
    return this.getStorage(trx).getCollection(collectionName).get(id);
  }

  delete(collectionName: string, id: string): void {
    // TODO: implement transactional delete
    this.storage.getCollection(collectionName).delete(id);
  }

  loadAll(collectionName: string, trx?: InMemoryTransactionId): any[] {
    return this.getStorage(trx).getCollection(collectionName).getAll();
  }

  loadLatestSnapshot(id: string) {
    return this.storage.getCollection("snapshots").getLatestSnapshot(id);
  }

  save(
    collectionName: string,
    id: string,
    data: any,
    trx?: InMemoryTransactionId
  ): void {
    const globalStorage = this.storage;
    const targetStorage = this.getStorage(trx);

    if (
      globalStorage.getCollection(collectionName).get(id) &&
      globalStorage.getCollection(collectionName).get(id) !==
        targetStorage.getCollection(collectionName).get(id)
    ) {
      throw new WriteCollisionDetected(id);
    }

    targetStorage.getCollection(collectionName).save(id, data);
  }

  private initiateTransaction(trx = Math.random().toString().substring(2)) {
    const snapshot = this.storage.clone();

    this.transactions.set(trx, snapshot);
    return trx;
  }

  async transactionally(fn: (trx: InMemoryTransactionId) => any) {
    const trx = this.initiateTransaction();
    let retry = 5;
    let latestReturnValue = undefined;
    while (retry--) {
      try {
        latestReturnValue = await fn(trx);
        this.commit(trx);
        break;
      } catch (error) {
        if (
          error instanceof WriteCollisionDetected ||
          error instanceof TransactionNotFound
        ) {
          this.initiateTransaction(trx);
        } else {
          throw error;
        }
      }
    }

    if (retry === -1) {
      throw new Error("failed to execute transaction after 5 retries");
    }

    return latestReturnValue;
  }

  private commit(trx: InMemoryTransactionId): void {
    const snapshot = this.transactions.get(trx);
    if (!snapshot) {
      throw new TransactionNotFound(trx);
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
