import { PromiseOr } from "@ddd-ts/serialization";
import { InMemoryTransaction } from "..";
import { Collection } from "./in-memory.collection";
import { Storage } from "./in-memory.storage";

export class CannotReadAfterWrites extends Error {
  constructor() {
    super("Cannot read after having written into a transaction");
  }
}

export class TransactionCollision extends Error {
  constructor() {
    super("Transaction has collided with other extern writes");
  }
}

export class TransactionCollidedTooManyTimes extends Error {
  constructor(tries: number) {
    super(`Transaction collided too many times (${tries})`);
  }
}

type ReadOperation = {
  type: "read";
  collectionName: string;
  id: string;
  savedAt: number | undefined;
};

type WriteOperation = {
  type: "write";
  collectionName: string;
  id: string;
  data: any;
};

type DeleteOperation = {
  type: "delete";
  collectionName: string;
  id: string;
  savedAt: number | undefined;
};

type TransactionOperation = ReadOperation | WriteOperation | DeleteOperation;

export class InMemoryUnderlyingTransaction {
  public readonly operations: TransactionOperation[] = [];

  public readonly id = Math.random().toString().substring(2);

  private ensureNoWrites() {
    if (
      this.operations.some(
        (operation) => operation.type === "write" || operation.type === "delete"
      )
    ) {
      throw new CannotReadAfterWrites();
    }
  }

  public markRead(
    collectionName: string,
    id: string,
    savedAt: number | undefined
  ) {
    this.ensureNoWrites();
    this.operations.push({ type: "read", collectionName, id, savedAt });
  }

  public markWritten(collectionName: string, id: any, data: any) {
    this.operations.push({ type: "write", collectionName, id, data });
  }

  public markDeleted(
    collectionName: string,
    id: any,
    savedAt: number | undefined
  ) {
    this.operations.push({ type: "delete", collectionName, id, savedAt });
  }

  public checkConsistency(storage: Storage) {
    for (const operation of this.operations) {
      if (operation.type !== "read") {
        continue;
      }

      const collection = storage.getCollection(operation.collectionName);

      if (!collection) {
        return false;
      }

      if (operation.savedAt !== collection.getRaw(operation.id)?.savedAt) {
        return false;
      }
    }
    return true;
  }
}

export class InMemoryDatabase {
  private storage = new Storage();

  clear(collectionName: string) {
    this.storage.getCollection(collectionName).clear();
  }

  load(
    collectionName: string,
    id: string,
    trx?: InMemoryUnderlyingTransaction
  ): any {
    const collection = this.storage.getCollection(collectionName);
    const data = collection.get(id);
    if (trx) {
      const doc = collection.getRaw(id);
      trx.markRead(collectionName, id, doc?.savedAt);
    }
    return data;
  }

  delete(
    collectionName: string,
    id: string,
    trx?: InMemoryUnderlyingTransaction
  ): void {
    if (trx) {
      const doc = this.storage.getCollection(collectionName).getRaw(id);
      trx.markDeleted(collectionName, id, doc?.savedAt);
    } else {
      this.storage.getCollection(collectionName).delete(id);
    }
  }

  countAll(collectionName: string) {
    return this.storage.getCollection(collectionName).countAll();
  }

  loadAll(collectionName: string) {
    return this.storage.getCollection(collectionName).getAllRaw();
  }

  loadLatestSnapshot(id: string) {
    return this.storage.getCollection("snapshots").getLatestSnapshot(id);
  }

  save(
    collectionName: string,
    id: string,
    data: any,
    trx?: InMemoryUnderlyingTransaction
  ): void {
    if (trx) {
      trx.markWritten(collectionName, id, data);
    } else {
      this.storage.getCollection(collectionName).save(id, data);
    }
  }

  private static transactionTries = 5;

  async transactionally(fn: (trx: InMemoryTransaction) => any) {
    let trx = new InMemoryTransaction(new InMemoryUnderlyingTransaction());
    let retry = InMemoryDatabase.transactionTries;
    let latestReturnValue = undefined;
    while (retry--) {
      try {
        latestReturnValue = await fn(trx);
        this.commit(trx);
        break;
      } catch (error) {
        if (error instanceof TransactionCollision) {
          trx = new InMemoryTransaction(new InMemoryUnderlyingTransaction());
        } else {
          throw error;
        }
      }
    }

    if (retry === -1) {
      throw new TransactionCollidedTooManyTimes(
        InMemoryDatabase.transactionTries
      );
    }

    return latestReturnValue;
  }

  private commit(trx: InMemoryTransaction): void {
    if (!trx.transaction.checkConsistency(this.storage)) {
      throw new TransactionCollision();
    }

    for (const operation of trx.transaction.operations) {
      if (operation.type === "read") {
        continue;
      }
      if (operation.type === "write") {
        this.save(operation.collectionName, operation.id, operation.data);
      }
      if (operation.type === "delete") {
        this.delete(operation.collectionName, operation.id);
      }
    }
  }

  print() {
    console.log(["Database:", this.storage.toPretty()].join("\n"));
  }
}
