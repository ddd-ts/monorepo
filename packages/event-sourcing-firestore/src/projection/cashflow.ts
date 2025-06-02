import {
  AutoSerializer,
  EventId,
  IEsEvent,
  ProjectedStream,
  StreamSource,
} from "@ddd-ts/core";
import {
  Account,
  AccountId,
  AccountOpened,
  AccountRenamed,
  Deposited,
  Withdrawn,
} from "./write";
import { ProjectionCheckpointId } from "./checkpoint-id";
import { Lock } from "./lock";
import {
  FirestoreStore,
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { ProjectionCheckpointStore } from "./checkpoint";
import { wait } from "./tools";
import { FieldValue } from "firebase-admin/firestore";
import { Shape } from "../../../shape/dist";

export class AccountCashflowProjectedStream extends ProjectedStream {
  constructor() {
    super({
      sources: [
        new StreamSource({
          aggregateType: Account.name,
          shardKey: "accountId",
          events: [
            AccountOpened.name,
            Deposited.name,
            Withdrawn.name,
            AccountRenamed.name,
          ],
        }),
      ],
    });
  }
}

class Cashflow extends Shape({
  id: AccountId,
  name: String,
  all_names: [String],
  flow: Number,
}) {}

class CashflowSerializer extends AutoSerializer.First(Cashflow) {}

class FirestoreCashflowStore extends FirestoreStore<Cashflow> {
  constructor(db: FirebaseFirestore.Firestore) {
    super(db.collection("Cashflow"), new CashflowSerializer(), "Cashflow");
  }

  async init_transaction(accountId: AccountId, trx: FirestoreTransaction) {
    await trx.transaction.create(this.collection.doc(accountId.serialize()), {
      id: accountId.serialize(),
      flow: 0,
      name: accountId.serialize(),
      all_names: [],
    });
  }

  async increment_transaction(
    accountId: AccountId,
    amount: number,
    trx: FirestoreTransaction,
  ) {
    await trx.transaction.update(this.collection.doc(accountId.serialize()), {
      flow: FieldValue.increment(amount),
    });
  }

  async rename_transaction(
    accountId: AccountId,
    newName: string,
    trx: FirestoreTransaction,
  ) {
    await trx.transaction.update(this.collection.doc(accountId.serialize()), {
      name: newName,
      all_names: FieldValue.arrayUnion(newName),
    });
  }
}

export class AccountCashflowProjection {
  constructor(
    private readonly transaction: FirestoreTransactionPerformer,
    private readonly checkpointStore: ProjectionCheckpointStore,
    public readonly cashflowStore: FirestoreCashflowStore = new FirestoreCashflowStore(
      checkpointStore.firestore,
    ),
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
    return;
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
    [AccountOpened.name]: {
      handle: async (
        checkpointId: ProjectionCheckpointId,
        events: AccountOpened[],
      ) => {
        return Promise.all(
          events.map(async (event) => {
            try {
              return await Promise.race([
                wait(10_000_00).then(() => {
                  console.log(`Timeout for event ${event.id.serialize()}`);
                  throw new Error(`Timeout ${event.id.serialize()}`);
                }),
                this.transaction.perform(async (trx) => {
                  await this.suspend(event);

                  await this.cashflowStore.init_transaction(
                    event.payload.accountId,
                    trx,
                  );

                  await this.checkpointStore.processed(
                    checkpointId,
                    event.id,
                    trx,
                  );
                  return event.id;
                }),
              ]);
            } catch (error) {
              console.error(
                `Error processing event ${event.id.serialize()}: ${error}`,
              );
              await this.checkpointStore.failed(checkpointId, event.id);
            }
          }),
        );
      },
      locks: (event: AccountOpened) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
        });
      },
      timeout: 10_000_00 * 4,
    },
    [Deposited.name]: {
      handle: async (
        checkpointId: ProjectionCheckpointId,
        events: Deposited[],
      ) => {
        return Promise.all(
          events.map(async (event) => {
            try {
              let timedOut = false;
              const result = await Promise.race([
                wait(10_000_00).then(() => {
                  console.log(`Timeout for event ${event.id.serialize()}`);
                  timedOut = true;
                  throw new Error(`Timeout ${event.id.serialize()}`);
                }),
                this.transaction.perform(async (trx) => {
                  await this.suspend(event);

                  await this.cashflowStore.increment_transaction(
                    event.payload.accountId,
                    event.payload.amount,
                    trx,
                  );

                  await this.checkpointStore.processed(
                    checkpointId,
                    event.id,
                    trx,
                  );

                  if (timedOut) {
                    console.log(`Event ${event.id.serialize()} timed out`);
                    throw new Error(`Timeout ${event.id.serialize()}`);
                  }

                  return event.id;
                }),
              ]);
              return result;
            } catch (error) {
              await this.checkpointStore.failed(checkpointId, event.id);
            }
          }),
        );
      },
      locks: (event: Deposited) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          eventId: event.id.serialize(),
        });
      },
      timeout: 10_000_00 * 4,
    },
    [Withdrawn.name]: {
      handle: async (
        checkpointId: ProjectionCheckpointId,
        events: Withdrawn[],
      ) => {
        return Promise.all(
          events.map(async (event) => {
            try {
              return await this.transaction.perform(async (trx) => {
                await this.suspend(event);

                await this.cashflowStore.increment_transaction(
                  event.payload.accountId,
                  event.payload.amount,
                  trx,
                );

                await this.checkpointStore.processed(
                  checkpointId,
                  event.id,
                  trx,
                );

                return event.id;
              });
            } catch (error) {
              await this.checkpointStore.failed(checkpointId, event.id);
            }
          }),
        );
      },
      locks: (event: Withdrawn) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          eventId: event.id.serialize(),
        });
      },
      timeout: 4000,
    },
    [AccountRenamed.name]: {
      handle: async (
        checkpointId: ProjectionCheckpointId,
        events: AccountRenamed[],
      ) => {
        const last = events.at(-1);

        if (!last) {
          return [];
        }

        try {
          await this.transaction.perform(async (trx) => {
            console.log(`TRANSACTION STARTED FOR ${last}`);
            await this.suspend(last);

            await this.cashflowStore.rename_transaction(
              last.payload.accountId,
              last.payload.newName,
              trx,
            );

            for (const event of events) {
              await this.checkpointStore.processed(checkpointId, event.id, trx);
            }
          });
          return events.map((e) => e.id);
        } catch (error) {
          await Promise.all(
            events.map((e) => this.checkpointStore.failed(checkpointId, e.id)),
          );
          return [];
        }
      },
      locks: (event: Withdrawn) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          type: "rename",
        });
      },
      timeout: 4000,
    },
  };

  async process(checkpointId: ProjectionCheckpointId, events: IEsEvent[]) {
    const byEvent = events.reduce(
      (acc, event) => {
        const name = event.name;
        if (!acc[name]) {
          acc[name] = [];
        }
        acc[name].push(event as IEsEvent);
        return acc;
      },
      {} as Record<string, IEsEvent[]>,
    );

    const promises = Object.entries(byEvent).map(async ([name, events]) => {
      const handler = this.handlers[name];

      if (!handler) {
        throw new Error(`No handler for event ${name}`);
      }

      const processed = await handler.handle(checkpointId, events as any);

      return processed.filter((e) => !!e);
    });

    const all = await Promise.all(promises);

    return all.flat();
  }
}

// class CashflowOnAccountOpenedTransactionProjectionHandler {
//   constructor(
//     private readonly transaction: FirestoreTransactionPerformer,
//     private readonly checkpointStore: ProjectionCheckpointStore,
//   ) {}

//   timeout = 4000; // 4 seconds

//   locks(event: AccountOpened) {
//     return new Lock({
//       accountId: event.payload.accountId.serialize(),
//     });
//   }

//   async process(checkpointId: ProjectionCheckpointId, event: AccountOpened) {
//     try {
//       const operation = this.transaction.perform(async (trx) => {
//         await this.handle(event, trx);
//         await this.checkpointStore.processed(checkpointId, event.id, trx);
//       });
//       await Promise.race([
//         operation,
//         wait(this.timeout).then(() => {
//           throw new Error(`Timeout ${event.id.serialize()}`);
//         }),
//       ]);
//       return true;
//     } catch (error) {
//       await this.checkpointStore.failed(checkpointId, event.id);
//       return false;
//     }
//   }

//   async handle(event: AccountOpened, trx: FirestoreTransaction) {}
// }

// abstract class FirestoreTransactionProjectionHandler<Event extends IEsEvent> {
//   constructor(
//     readonly transaction: FirestoreTransactionPerformer,
//     readonly checkpointStore: ProjectionCheckpointStore,
//   ) {}
//   abstract timeout: number;
//   abstract locks(event: IEsEvent): Lock;
//   async process(checkpointId: ProjectionCheckpointId, event: Event) {
//     try {
//       await this.transaction.perform(async (trx) => {
//         await Promise.race([
//           this.handle(event, trx),
//           wait(this.timeout).then(() => {
//             throw new Error(`Timeout ${event.id.serialize()}`);
//           }),
//         ]);
//         await this.checkpointStore.processed(checkpointId, event.id, trx);
//       });
//       return true;
//     } catch (error) {
//       await this.checkpointStore.failed(checkpointId, event.id);
//       return false;
//     }
//   }

//   abstract handle(event: Event, trx: FirestoreTransaction): Promise<void>;

//   static for<E extends IEsEvent>({
//     handle,
//     locks,
//     timeout,
//     transaction,
//     checkpointStore,
//   }: {
//     handle: (event: E, trx: FirestoreTransaction) => Promise<void>;
//     locks: (event: E) => Lock;
//     timeout: number;
//     transaction: FirestoreTransactionPerformer;
//     checkpointStore: ProjectionCheckpointStore;
//   }) {
//     return new (class extends FirestoreTransactionProjectionHandler<E> {
//       timeout = timeout; // 4 seconds

//       locks(event: E) {
//         return locks(event);
//       }

//       async handle(event: E, trx: FirestoreTransaction) {
//         await handle(event, trx);
//       }
//     })(transaction, checkpointStore);
//   }
// }

// class CashflowOnAccountOpenedBatchedWriteProjectionHandler {
//   constructor(private readonly checkpointStore: ProjectionCheckpointStore) {}

//   locks(event: AccountOpened) {
//     return new Lock({
//       accountId: event.payload.accountId.serialize(),
//     });
//   }

//   async process(checkpointId: ProjectionCheckpointId, event: AccountOpened) {
//     const batch = this.checkpointStore.firestore.batch();
//     await this.handle(event, batch);
//     await this.checkpointStore.processedBatch(checkpointId, event.id, batch);
//     await batch.commit();
//   }

//   async handle(event: AccountOpened, batch: WriteBatch) {}
// }

// class BatchedCashflowOnAccountOpenedBatchedWriteProjectionHandler {
//   constructor(private readonly checkpointStore: ProjectionCheckpointStore) {}

//   locks(event: AccountOpened) {
//     return new Lock({
//       accountId: event.payload.accountId.serialize(),
//     });
//   }

//   async process(checkpointId: ProjectionCheckpointId, event: AccountOpened) {
//     const batch = this.checkpointStore.firestore.batch();
//     await this.handle(event, batch);
//     await this.checkpointStore.processedBatch(checkpointId, event.id, batch);
//     await batch.commit();
//   }

//   async handle(events: AccountOpened[], batch: WriteBatch) {}
// }

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
