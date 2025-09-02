process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
import * as fb from "firebase-admin";
import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  FirestoreStore,
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { IEventBus, ProjectionContext, ProjectorTesting } from "@ddd-ts/core";
import { FirestoreProjectedStreamReader } from "../firestore.projected-stream.reader";
import { MakeFirestoreEventStreamAggregateStore } from "../firestore.event-stream.aggregate-store";
import { FirestoreQueueStore, FirestoreProjector } from "./firestore.projector";

const app = fb.initializeApp({ projectId: "demo-es" });
const database = app.firestore();

jest.setTimeout(120_000);

const { Account, CashflowProjection } = ProjectorTesting;

type AccountId = InstanceType<typeof ProjectorTesting.AccountId>;
type Cashflow = InstanceType<typeof ProjectorTesting.Cashflow>;
type CashflowSerializer = InstanceType<
  typeof ProjectorTesting.CashflowSerializer
>;

describe("Firestore Projector", () => {
  const suite = ProjectorTesting.Suite((registry) => {
    class AccountStore extends MakeFirestoreEventStreamAggregateStore(Account) {
      constructor(firestore: Firestore, eventBus?: IEventBus) {
        super(firestore, registry, eventBus);
      }
    }

    class FirestoreCashflowStore extends FirestoreStore<
      Cashflow,
      CashflowSerializer
    > {
      constructor(db: FirebaseFirestore.Firestore) {
        super(
          db.collection("Cashflow"),
          new ProjectorTesting.CashflowSerializer(),
          "Cashflow",
        );
      }

      async init(
        accountId: AccountId,
        context = ProjectionContext.get<{ trx: FirestoreTransaction }>(),
      ) {
        await context.trx?.transaction.create(
          this.collection.doc(accountId.serialize()),
          {
            id: accountId.serialize(),
            flow: 0,
            name: accountId.serialize(),
            all_names: [],
            version: 1,
          },
        );
      }

      failures = new Map<string, Map<number, number>>();
      async increment(
        accountId: AccountId,
        amount: number,
        context = ProjectionContext.get<{ trx: FirestoreTransaction }>(),
      ) {
        const id = accountId.serialize();

        // if (amount === 404) {
        //   throw new Error("Amount cannot be 404");
        // }

        // if (amount > 50000 && amount < 60000) {
        //   const defaultFailures = new Map([[amount, amount - 50000]]);
        //   const failures = this.failures.get(id) || defaultFailures;
        //   this.failures.set(id, failures);

        //   const failuresLeft = failures.get(amount)!;
        //   failures.set(amount, failuresLeft - 1);

        //   if (failuresLeft >= 1) {
        //     throw new Error(
        //       `Simulated failure for amount ${amount} (${failuresLeft} failures left)`,
        //     );
        //   }
        // }

        await context.trx?.transaction.update(
          this.collection.doc(accountId.serialize()),
          {
            flow: FieldValue.increment(amount),
          },
        );
      }

      async rename(
        accountId: AccountId,
        newName: string,
        context = ProjectionContext.get<{ trx: FirestoreTransaction }>(),
      ) {
        await context.trx?.transaction.update(
          this.collection.doc(accountId.serialize()),
          {
            name: newName,
            all_names: FieldValue.arrayUnion(newName),
          },
        );
      }
    }

    return () => {
      const transaction = new FirestoreTransactionPerformer(database);
      const accountStore = new AccountStore(database);
      const cashflowStore = new FirestoreCashflowStore(database);

      const projection = new CashflowProjection(transaction, cashflowStore);

      const reader = new FirestoreProjectedStreamReader<any>(
        database,
        registry,
      );

      const queueStore = new FirestoreQueueStore(database);

      const projector = new FirestoreProjector(projection, reader, queueStore, {
        onEnqueueError: console.log,
        onProcessError: console.error,
        retry: { attempts: 40, minDelay: 100, maxDelay: 1000 },
        enqueue: { batchSize: 50 },
      });

      return {
        accountStore,
        projection,
        projector,
        cashflowStore,
        disableUnclaimOnFailure: () => {
          projector._unclaim = false;
        },
      };
    };
  });

  it("SingleEvent", () => suite.SingleEvent(), 40000);

  it("SimpleLocking", () => suite.SimpleLocking());

  it("SimpleConcurrency", () => suite.SimpleConcurrency());

  it("SimpleBatching", () => suite.SimpleBatching());

  it("DuplicateHandling", () => suite.DuplicateHandling());

  it("HeavyHandleConcurrency", () => suite.HeavyHandleConcurrency());

  it("TemporalLockRestraint", () => suite.TemporalLockRestraint());
  it("TemporalLockConcurrencyRestraint", () =>
    suite.TemporalLockConcurrencyRestraint());

  it("ComprehensiveVolumeStressTest", () =>
    suite.ComprehensiveVolumeStressTest());

  it("RealisticAccountWorkflowStressTest", () =>
    suite.RealisticAccountWorkflowStressTest());

  it("ExplicitFailureRetry", () => suite.ExplicitFailureRetry());

  it("ExplicitTimeoutFailureRetry", () => suite.ExplicitTimeoutFailureRetry());

  it("ImplicitTimeoutFailureRetry", () => suite.ImplicitTimeoutFailureRetry());

  it("ImplicitFailureSkip", () => suite.ImplicitFailureSkip());

  it("ImplicitFailureRetry", () => suite.ImplicitFailureRetry());
});
