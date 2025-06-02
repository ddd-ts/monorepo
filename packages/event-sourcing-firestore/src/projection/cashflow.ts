import { IEsEvent, INamed, ProjectedStream, StreamSource } from "@ddd-ts/core";
import {
  Account,
  AccountId,
  AccountOpened,
  Deposited,
  Withdrawn,
} from "./write";
import { ProjectionCheckpointId } from "./checkpoint-id";
import { Lock } from "./lock";
import {
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { ProjectionCheckpointStore } from "./checkpoint";
import { WriteBatch } from "firebase-admin/firestore";
import { wait } from "./tools";
import { Constructor } from "@ddd-ts/types";

export class AccountCashflowProjectedStream extends ProjectedStream {
  constructor() {
    super({
      sources: [
        new StreamSource({
          aggregateType: Account.name,
          shardKey: "accountId",
          events: [AccountOpened.name, Deposited.name, Withdrawn.name],
        }),
      ],
    });
  }
}

export class AccountCashflowProjection {
  constructor(
    private readonly transaction: FirestoreTransactionPerformer,
    private readonly checkpointStore: ProjectionCheckpointStore,
  ) {}
  state: Record<string, number> = {};

  getShardCheckpointId(event: AccountOpened | Deposited | Withdrawn) {
    return ProjectionCheckpointId.from(
      "AccountCashflow",
      event.payload.accountId,
    );
  }

  source = new AccountCashflowProjectedStream();

  awaiters = new Map<string, Set<(value: any) => void>>();

  suspended = new Map<
    string,
    Set<{ resume: () => void; fail: (error: any) => void }>
  >();
  suspend(event: IEsEvent) {
    const id = Math.random().toString(36).substring(2, 15);
    console.log(`Suspending event ${event.id.serialize()} with id ${id}`);
    return new Promise((resolve, reject) => {
      const resolvers = this.suspended.get(event.id.serialize()) || new Set();
      resolvers.add({ resume: () => resolve(undefined), fail: reject });
      this.suspended.set(event.id.serialize(), resolvers);
      for (const [key, value] of this.awaiters.entries()) {
        if (key === event.id.serialize()) {
          // biome-ignore lint/complexity/noForEach: <explanation>
          value.forEach((r) =>
            r({ resume: () => resolve(undefined), fail: reject }),
          );
          this.awaiters.delete(key);
        }
      }
    }).then(() => {
      console.log(`Event ${event.id.serialize()} resumed id ${id}`);
    });
  }

  isSuspended(event: IEsEvent) {
    return this.suspended.has(event.id.serialize());
  }

  resume(event: IEsEvent) {
    const resolvers = this.suspended.get(event.id.serialize());
    if (resolvers) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      resolvers.forEach(({ resume }) => resume());
      this.suspended.delete(event.id.serialize());
    }
  }

  fail(event: IEsEvent, error: Error) {
    const resolvers = this.suspended.get(event.id.serialize());
    if (resolvers) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      resolvers.forEach(({ fail }) => fail(error));
      this.awaiters.delete(event.id.serialize());
    }
  }

  async awaitSuspend(
    event: IEsEvent,
  ): Promise<{ resume: () => void; fail: (error: any) => void }> {
    return new Promise((resolve, reject) => {
      const resolvers = this.awaiters.get(event.id.serialize()) || new Set();
      resolvers.add(resolve);
      this.awaiters.set(event.id.serialize(), resolvers);
    });
  }

  async tick() {
    console.log("tick start");
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("tick end");
  }

  handlers = {
    [AccountOpened.name]:
      FirestoreTransactionProjectionHandler.for<AccountOpened>({
        handle: async (event: AccountOpened) => {
          console.log("before suspend", event.toString());
          await this.suspend(event);
          console.log("after suspend", event.toString());
          if (this.state[event.payload.accountId.serialize()] !== undefined) {
            throw new Error("Account already opened");
          }
          this.state[event.payload.accountId.serialize()] = 0;
        },
        locks: (event: AccountOpened) => {
          return new Lock({
            accountId: event.payload.accountId.serialize(),
          });
        },
        timeout: 4000,
        transaction: this.transaction,
        checkpointStore: this.checkpointStore,
      }),
    [Deposited.name]: FirestoreTransactionProjectionHandler.for<Deposited>({
      handle: async (event: Deposited) => {
        console.log("before suspend", event.toString());
        await this.suspend(event);
        console.log("after suspend", event.toString());

        if (this.state[event.payload.accountId.serialize()] === undefined) {
          throw new Error("Account not opened");
        }
        this.state[event.payload.accountId.serialize()] += event.payload.amount;
      },
      locks: (event: Deposited) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          eventId: event.id.serialize(),
        });
      },
      timeout: 4000,
      transaction: this.transaction,
      checkpointStore: this.checkpointStore,
    }),
    [Withdrawn.name]: FirestoreTransactionProjectionHandler.for<Withdrawn>({
      handle: async (event: Withdrawn) => {
        console.log("before suspend", event.toString());
        await this.suspend(event);
        console.log("after suspend", event.toString());
        if (this.state[event.payload.accountId.serialize()] === undefined) {
          throw new Error("Account not opened");
        }
        this.state[event.payload.accountId.serialize()] += event.payload.amount;
      },
      locks: (event: Withdrawn) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          eventId: event.id.serialize(),
        });
      },
      timeout: 4000,
      transaction: this.transaction,
      checkpointStore: this.checkpointStore,
    }),
  };

  onDeposited(event: Deposited) {
    this.state[event.payload.accountId.serialize()] += event.payload.amount;
  }

  onWithdrawn(event: Withdrawn) {
    this.state[event.payload.accountId.serialize()] -= event.payload.amount;
  }
}

class CashflowOnAccountOpenedTransactionProjectionHandler {
  constructor(
    private readonly transaction: FirestoreTransactionPerformer,
    private readonly checkpointStore: ProjectionCheckpointStore,
  ) {}

  timeout = 4000; // 4 seconds

  locks(event: AccountOpened) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
    });
  }

  async process(checkpointId: ProjectionCheckpointId, event: AccountOpened) {
    try {
      const operation = this.transaction.perform(async (trx) => {
        await this.handle(event, trx);
        await this.checkpointStore.processed(checkpointId, event.id, trx);
      });
      await Promise.race([
        operation,
        wait(this.timeout).then(() => {
          throw new Error(`Timeout ${event.id.serialize()}`);
        }),
      ]);
      return true;
    } catch (error) {
      await this.checkpointStore.failed(checkpointId, event.id);
      return false;
    }
  }

  async handle(event: AccountOpened, trx: FirestoreTransaction) {}
}

abstract class FirestoreTransactionProjectionHandler<Event extends IEsEvent> {
  constructor(
    readonly transaction: FirestoreTransactionPerformer,
    readonly checkpointStore: ProjectionCheckpointStore,
  ) {}
  abstract timeout: number;
  abstract locks(event: IEsEvent): Lock;
  async process(checkpointId: ProjectionCheckpointId, event: Event) {
    try {
      await this.transaction.perform(async (trx) => {
        await Promise.race([
          this.handle(event, trx),
          wait(this.timeout).then(() => {
            throw new Error(`Timeout ${event.id.serialize()}`);
          }),
        ]);
        await this.checkpointStore.processed(checkpointId, event.id, trx);
      });
      return true;
    } catch (error) {
      await this.checkpointStore.failed(checkpointId, event.id);
      return false;
    }
  }

  abstract handle(event: Event, trx: FirestoreTransaction): Promise<void>;

  static for<E extends IEsEvent>({
    handle,
    locks,
    timeout,
    transaction,
    checkpointStore,
  }: {
    handle: (event: E, trx: FirestoreTransaction) => Promise<void>;
    locks: (event: E) => Lock;
    timeout: number;
    transaction: FirestoreTransactionPerformer;
    checkpointStore: ProjectionCheckpointStore;
  }) {
    return new (class extends FirestoreTransactionProjectionHandler<E> {
      timeout = timeout; // 4 seconds

      locks(event: E) {
        return locks(event);
      }

      async handle(event: E, trx: FirestoreTransaction) {
        await handle(event, trx);
      }
    })(transaction, checkpointStore);
  }
}

class CashflowOnAccountOpenedBatchedWriteProjectionHandler {
  constructor(private readonly checkpointStore: ProjectionCheckpointStore) {}

  locks(event: AccountOpened) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
    });
  }

  async process(checkpointId: ProjectionCheckpointId, event: AccountOpened) {
    const batch = this.checkpointStore.firestore.batch();
    await this.handle(event, batch);
    await this.checkpointStore.processedBatch(checkpointId, event.id, batch);
    await batch.commit();
  }

  async handle(event: AccountOpened, batch: WriteBatch) {}
}

class BatchedCashflowOnAccountOpenedBatchedWriteProjectionHandler {
  constructor(private readonly checkpointStore: ProjectionCheckpointStore) {}

  locks(event: AccountOpened) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
    });
  }

  async process(checkpointId: ProjectionCheckpointId, event: AccountOpened) {
    const batch = this.checkpointStore.firestore.batch();
    await this.handle(event, batch);
    await this.checkpointStore.processedBatch(checkpointId, event.id, batch);
    await batch.commit();
  }

  async handle(events: AccountOpened[], batch: WriteBatch) {}
}

// class DelayMiddleware<T> {
//   async intercept<C extends {}>(message: T, context: C) {
//     await new Promise((resolve) => setTimeout(resolve, 1000));
//     return [message, context] as const;
//   }
// }
// class DelayMiddleware2<T> {
//   async *intercept<C extends {}>(stream: AsyncIterableIterator<T>) {
//     for await (const message of stream) {
//       yield wait(1000).then(() => message)
//     }
//   }
// }

// class SequentialMiddleware2<T> {
//   async *intercept<C extends {}>(stream: AsyncIterableIterator<T>) {
//     for await (const message of stream) {
//       const operation = yield message;
//       await operation;
//     }
//   }
// }

// class SequentialByMiddleware<T> {
//   constructor(private readonly key: (message: T) => string) {}
//   async *intercept<C extends {}>(stream: AsyncIterableIterator<T>) {
//     const operations = new Map<string, Promise<void>>();

//     for await (const message of stream) {
//       const key = this.key(message);
//       if (!operations.has(key)) {
//         operations.set(key, Promise.resolve());
//       }

//       const operation = operations.get(key)!;

//       yield operation.then(() => message).then((msg) => {
//         operations.delete(key);
//         return msg;
//       });

//       operations.set(
//         key,
//         operation.then(() => wait(1000)), // Simulate some processing
//       );
//     }
//   }
// }

// class DebounceMiddleware<T> {
//   constructor(private readonly delay: number) {}

//   async *intercept<C extends {}>(stream: AsyncIterableIterator<T>) {
//     const batch = new Set<T>();

//     const iterable = stream[Symbol.asyncIterator]();

//     iterable.next();
//     for await (const item of iterable) {
//       batch.add(item);
//       yield item;
//     }
//   }

// class TransactionMiddleware<T> {
//   constructor(private readonly transaction: FirestoreTransactionPerformer) {}

//   intercept<C extends {}>(message: T, context: C) {
//     return this.transaction.perform(async (trx) => {

//     });
//   }
// }

// function runMiddlewares(middlewares: any[], message: any) {
//   for()
// }
