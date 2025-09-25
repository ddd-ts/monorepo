process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
import * as fb from "firebase-admin";
import { FieldValue, Firestore } from "firebase-admin/firestore";
import {
  ESProjection,
  ProjectedStream,
  StreamSource,
  CheckpointId,
  Lock,
  ProjectorTesting,
  Handler,
  ProjectionContext,
} from "@ddd-ts/core";
import { Derive } from "@ddd-ts/traits";
import {
  FirestoreTransactionPerformer,
  FirestoreTransaction,
  FirestoreStore,
} from "@ddd-ts/store-firestore";
import { MakeFirestoreEventStreamAggregateStore } from "../../firestore.event-stream.aggregate-store";
import { FirestoreProjectedStreamReader } from "../../firestore.projected-stream.reader";
import {
  FirestoreProjector,
  FirestoreQueueStore,
} from "../firestore.projector";
import { AccountId } from "@ddd-ts/core/dist/projections/spec/account/account";
import { Cashflow } from "@ddd-ts/core/dist/projections/spec/cashflow/cashflow";

const {
  Account,
  AccountOpened,
  Deposited,
  Withdrawn,
  AccountRenamed,
  Registry,
} = ProjectorTesting as any;

export const locks = {
  wholeAccount: (e: any) =>
    new Lock({ accountId: e.payload.accountId.serialize() }),
  accountAndEventId: (e: any) =>
    new Lock({
      accountId: e.payload.accountId.serialize(),
      eventId: e.id.serialize(),
    }),
  rename: (e: any) =>
    new Lock({ accountId: e.payload.accountId.serialize(), type: "rename" }),
};

export const traits = {
  Transaction: () => Handler.Transaction<any>(),
  Context: () => Handler.Context,
  Suspense: () => Handler.Suspense,
  Parallel: () => Handler.Parallel,
  Sequential: () => Handler.Sequential,
  LocalRetry: (attempts: number, delay: number) =>
    Handler.LocalRetry(attempts, delay),
  LocalTimeout: (ms: number) => Handler.LocalTimeout(ms),
  ClaimTimeout: (ms: number) => Handler.ClaimTimeout(ms),
  Delay: (ms: number) => Handler.Delay(ms),
  SkipAfter: (ms: number) => Handler.SkipAfter(ms),
  IsolateAfter: (ms: number) => Handler.IsolateAfter(ms),
};

export const runtimeTrace = {
  entries: [] as Array<{ id: string; phase: "start" | "finish"; t: number }>,
  reset() {
    this.entries.length = 0;
  },
};

type TraitCtor = any;

function compose(...t: TraitCtor[]) {
  return t;
}

type HandlerRecipe = {
  chain: TraitCtor[];
  lock: (e: any) => Lock;
};

export function cashflowDefaults() {
  return {
    override(overrides: Partial<Record<string, HandlerRecipe>>) {
      return { overrides };
    },
    toHandlers() {
      return {} as any;
    },
  };
}

function makeOnOpened(
  store: CashflowDocStore,
  trx: FirestoreTransactionPerformer,
  recipe: HandlerRecipe,
) {
  const Derived = Derive(
    Handler.Base,
    Handler.WithProps<{ store: CashflowDocStore }>(),
    Handler.OnProcessed,
    ...recipe.chain,
  );
  class Impl extends Derived {
    locks(e: InstanceType<typeof AccountOpened>) {
      return locks.wholeAccount(e);
    }
    async handleOne(e: InstanceType<typeof AccountOpened>) {
      runtimeTrace.entries.push({
        id: e.id.serialize(),
        phase: "start",
        t: Date.now(),
      });
      await this.props.store.init(e.payload.accountId, e);
      runtimeTrace.entries.push({
        id: e.id.serialize(),
        phase: "finish",
        t: Date.now(),
      });
    }
  }
  return new Impl({ store, transaction: trx }) as any;
}

function makeOnFlow(
  store: CashflowDocStore,
  trx: FirestoreTransactionPerformer,
  recipe: HandlerRecipe,
) {
  const Derived = Derive(
    Handler.Base,
    Handler.WithProps<{ store: CashflowDocStore }>(),
    Handler.OnProcessed,
    ...recipe.chain,
  );
  class Impl extends Derived {
    locks(e: InstanceType<typeof Deposited> | InstanceType<typeof Withdrawn>) {
      return recipe.lock(e);
    }
    async handleOne(
      e: InstanceType<typeof Deposited> | InstanceType<typeof Withdrawn>,
    ) {
      await this.props.store.increment(
        e.payload.accountId,
        e.payload.amount,
        e,
      );
    }
    async process(events: any[], context: any) {
      for (const e of events)
        runtimeTrace.entries.push({
          id: e.id.serialize(),
          phase: "start",
          t: Date.now(),
        });
      const res = await super.process(events as any, context as any);
      for (const e of events)
        runtimeTrace.entries.push({
          id: e.id.serialize(),
          phase: "finish",
          t: Date.now(),
        });
      return res as any;
    }
  }
  return new Impl({ store, transaction: trx }) as any;
}

function makeOnRenamed(
  store: CashflowDocStore,
  trx: FirestoreTransactionPerformer,
  recipe: HandlerRecipe,
) {
  const Derived = Derive(
    Handler.Base,
    Handler.WithProps<{ store: CashflowDocStore }>(),
    Handler.OnProcessed,
    ...recipe.chain,
  );
  class Impl extends Derived {
    locks(e: InstanceType<typeof AccountRenamed>) {
      return recipe.lock(e);
    }
    async handleLast(e: InstanceType<typeof AccountRenamed>) {
      await this.props.store.rename(e.payload.accountId, e.payload.newName, e);
    }
    async process(events: any[], context: any) {
      for (const e of events)
        runtimeTrace.entries.push({
          id: e.id.serialize(),
          phase: "start",
          t: Date.now(),
        });
      const res = await super.process(events as any, context as any);
      for (const e of events)
        runtimeTrace.entries.push({
          id: e.id.serialize(),
          phase: "finish",
          t: Date.now(),
        });
      return res as any;
    }
  }
  return new Impl({ store, transaction: trx }) as any;
}

class CashflowDocStore extends FirestoreStore<Cashflow> {
  constructor(db: Firestore, collName: string) {
    super(
      db.collection(collName),
      new ProjectorTesting.CashflowSerializer(),
      "Cashflow",
    );
  }
  async init(
    accountId: any,
    event?: { id: { serialize(): string } },
    context = ProjectionContext.get<{ trx: FirestoreTransaction }>(),
  ) {
    await context.trx?.transaction.create(
      this.collection.doc(accountId.serialize()),
      {
        id: accountId.serialize(),
        flow: 0,
        name: accountId.serialize(),
        all_names: [],
        ops_trace: event ? [event.id.serialize()] : [],
        version: 1,
      },
    );
  }
  async increment(
    accountId: any,
    amount: number,
    event?: { id: { serialize(): string } },
    context = ProjectionContext.get<{ trx: FirestoreTransaction }>(),
  ) {
    await context.trx?.transaction.update(
      this.collection.doc(accountId.serialize()),
      {
        flow: FieldValue.increment(amount),
        ops_trace: event
          ? FieldValue.arrayUnion(event.id.serialize())
          : FieldValue.arrayUnion(),
      } as any,
    );
  }
  async rename(
    accountId: any,
    newName: string,
    event?: { id: { serialize(): string } },
    context = ProjectionContext.get<{ trx: FirestoreTransaction }>(),
  ) {
    await context.trx?.transaction.update(
      this.collection.doc(accountId.serialize()),
      {
        name: newName,
        all_names: FieldValue.arrayUnion(newName),
        ops_trace: event
          ? FieldValue.arrayUnion(event.id.serialize())
          : FieldValue.arrayUnion(),
      } as any,
    );
  }
}

class AccountStore extends MakeFirestoreEventStreamAggregateStore(Account) {
  constructor(firestore: Firestore) {
    super(firestore, Registry);
  }
}

class CashflowCaseProjection extends ESProjection<any, any> {
  source = new ProjectedStream({
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

  constructor(
    public readonly trx: FirestoreTransactionPerformer,
    public readonly store: CashflowDocStore,
    recipes: {
      Deposited: HandlerRecipe;
      Withdrawn: HandlerRecipe;
      AccountRenamed: HandlerRecipe;
      AccountOpened: HandlerRecipe;
    },
  ) {
    super();
    this.registerHandler(
      AccountOpened,
      makeOnOpened(store, trx, recipes.AccountOpened) as any,
    );
    this.registerHandler(
      Deposited,
      makeOnFlow(store, trx, recipes.Deposited) as any,
    );
    this.registerHandler(
      Withdrawn,
      makeOnFlow(store, trx, recipes.Withdrawn) as any,
    );
    this.registerHandler(
      AccountRenamed,
      makeOnRenamed(store, trx, recipes.AccountRenamed) as any,
    );
  }

  getSource() {
    return this.source;
  }
  getCheckpointId(e: any) {
    return CheckpointId.from("Cashflow", e.payload.accountId);
  }

  get testhandlers() {
    return this.handlers as any;
  }
}

export function caseFixture(
  caseName: string,
  opts: {
    handlers?: {
      Deposited?: HandlerRecipe;
      Withdrawn?: HandlerRecipe;
      AccountRenamed?: HandlerRecipe;
      AccountOpened?: HandlerRecipe;
    };
    projector?: {
      unclaimOnFailure?: boolean;
      retry?: { attempts: number; minDelay: number; maxDelay: number };
      enqueue?: { batchSize: number };
    };
  } = {},
) {
  const app = fb.apps.length
    ? fb.app()
    : fb.initializeApp({ projectId: "demo-es" });
  const db = app.firestore();
  const defaultFlow: HandlerRecipe = {
    chain: compose(
      traits.Context(),
      traits.Transaction(),
      traits.Suspense(),
      traits.LocalTimeout(200),
      traits.LocalRetry(2, 10),
      traits.ClaimTimeout(2000),
      traits.Parallel(),
    ),
    lock: locks.accountAndEventId,
  };
  const defaultRename: HandlerRecipe = {
    chain: compose(
      traits.Context(),
      traits.Transaction(),
      traits.Suspense(),
      traits.LocalTimeout(2000),
      Handler.BatchLast,
    ),
    lock: locks.rename,
  } as any;

  const defaultOpened: HandlerRecipe = {
    chain: compose(
      traits.Context(),
      traits.Transaction(),
      traits.Suspense(),
      traits.Parallel(),
    ),
    lock: locks.wholeAccount,
  } as any;

  const recipes = {
    Deposited: opts.handlers?.Deposited || defaultFlow,
    Withdrawn: opts.handlers?.Withdrawn || defaultFlow,
    AccountRenamed: opts.handlers?.AccountRenamed || defaultRename,
    AccountOpened: opts.handlers?.AccountOpened || defaultOpened,
  } as const;

  return {
    name: caseName,
    describe: (fn: () => any) => describe(caseName, fn),
    async setup() {
      runtimeTrace.reset();
      const accountStore = new AccountStore(db);
      const cashflowStore = new CashflowDocStore(
        db as any,
        `Cashflow_${caseName}`,
      );
      // Cleanup any leftover docs from previous runs for determinism
      const existing = await (cashflowStore as any).collection.get();
      if (!existing.empty) {
        const batch = db.batch();
        for (const d of existing.docs as any) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
      const trx = new FirestoreTransactionPerformer(db);
      const projection = new CashflowCaseProjection(
        trx,
        cashflowStore,
        recipes as any,
      );
      const reader = new FirestoreProjectedStreamReader<any>(db, Registry);
      const queueStore = new FirestoreQueueStore(db);
      const projector = new FirestoreProjector(
        projection as any,
        reader,
        queueStore,
        {
          onEnqueueError: console.log,
          onProcessError: console.error,
          retry: opts.projector?.retry || {
            attempts: 10,
            minDelay: 100,
            maxDelay: 100,
          },
          enqueue: opts.projector?.enqueue || { batchSize: 50 },
        },
      );
      projector._unclaim =
        opts.projector?.unclaimOnFailure === false ? false : projector._unclaim;

      const events = {
        open: (name: string) => Account.open(name),
      };

      const act = {
        save: (account: any) => accountStore.save(account),
        handle: (event: any) => projector.handle(event),
      };

      const control = {
        markFailing: (event: any) =>
          projection.testhandlers[event.name].markFailing(event),
        suspend: (event: any) =>
          projection.testhandlers[event.name].suspend(event),
        wait: (ms: number) => new Promise((r) => setTimeout(r, ms)),
      };

      const assert = {
        cashflow: (id: any) => ({
          async toHave(partial: any) {
            const doc = await cashflowStore.load(id);
            expect(doc).toMatchObject(partial);
          },
          async toNotExist() {
            const doc = await cashflowStore.load(id);
            expect(doc).toBeUndefined();
          },
        }),
        async fetch(id: any) {
          return cashflowStore.load(id);
        },
      };

      return {
        db,
        accountStore,
        cashflowStore,
        projection,
        reader,
        queueStore,
        projector,
        trace: runtimeTrace,
        events,
        act,
        control,
        assert,
      } as const;
    },
  };
}
