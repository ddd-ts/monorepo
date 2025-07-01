import { ConcurrencyError } from "@ddd-ts/core";
import { InMemoryTransaction } from "..";
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

export class DocumentAlreadyExists extends ConcurrencyError {
  constructor() {
    super("Document already exists");
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
  savedAt: bigint | undefined;
};

type WriteOperation = {
  type: "write";
  collectionName: string;
  id: string;
  data: any;
};

type CreateOperation = {
  type: "create";
  collectionName: string;
  id: string;
  data: any;
};

type DeleteOperation = {
  type: "delete";
  collectionName: string;
  id: string;
  savedAt: bigint | undefined;
};

type TransactionOperation =
  | ReadOperation
  | WriteOperation
  | DeleteOperation
  | CreateOperation;

export class InMemoryUnderlyingTransaction {
  public readonly operations: TransactionOperation[] = [];

  public readonly id = Math.random().toString().substring(2);

  private ensureNoWrites() {
    if (
      this.operations.some(
        (operation) =>
          operation.type === "write" ||
          operation.type === "create" ||
          operation.type === "delete",
      )
    ) {
      throw new CannotReadAfterWrites();
    }
  }

  public markRead(
    collectionName: string,
    id: string,
    savedAt: bigint | undefined,
  ) {
    this.ensureNoWrites();
    this.operations.push({ type: "read", collectionName, id, savedAt });
  }

  public markWritten(collectionName: string, id: any, data: any) {
    this.operations.push({ type: "write", collectionName, id, data });
  }

  public markCreated(collectionName: string, id: any, data: any) {
    this.operations.push({ type: "create", collectionName, id, data });
  }

  public markDeleted(
    collectionName: string,
    id: any,
    savedAt: bigint | undefined,
  ) {
    this.operations.push({ type: "delete", collectionName, id, savedAt });
  }

  public checkConsistency(storage: Storage) {
    for (const operation of this.operations) {
      if (operation.type === "read") {
        const collection = storage.getCollection(operation.collectionName);

        if (!collection) {
          return false;
        }

        if (operation.savedAt !== collection.getRaw(operation.id)?.savedAt) {
          return false;
        }
      }

      if (operation.type === "create") {
        const collection = storage.getCollection(operation.collectionName);

        if (
          collection &&
          collection.getRaw(operation.id)?.savedAt !== undefined
        ) {
          throw new DocumentAlreadyExists();
        }
      }
    }
    return true;
  }
}

export class InMemoryDatabase {
  public storage = new Storage();

  clear(collectionName: string) {
    this.storage.getCollection(collectionName).clear();
  }

  load(
    collectionName: string,
    id: string,
    trx?: InMemoryUnderlyingTransaction,
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
    trx?: InMemoryUnderlyingTransaction,
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
    trx?: InMemoryUnderlyingTransaction,
  ): void {
    if (trx) {
      trx.markWritten(collectionName, id, data);
    } else {
      this.storage.getCollection(collectionName).save(id, data);
    }
  }

  create(
    collectionName: string,
    id: string,
    data: any,
    trx?: InMemoryUnderlyingTransaction,
  ): void {
    if (trx) {
      trx.markCreated(collectionName, id, data);
    } else {
      if (this.storage.getCollection(collectionName).get(id)) {
        throw new Error(`Document with id ${id} already exists`);
      }
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
        this.streamId(trx);
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
        InMemoryDatabase.transactionTries,
      );
    }

    return latestReturnValue;
  }

  private streamId(trx: InMemoryTransaction) {
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
      if (operation.type === "create") {
        this.create(operation.collectionName, operation.id, operation.data);
      }
    }
  }

  print() {
    console.log(["Database:", this.storage.toPretty()].join("\n"));
  }
}
