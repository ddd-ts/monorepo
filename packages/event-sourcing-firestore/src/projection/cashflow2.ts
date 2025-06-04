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
import { CheckpointId } from "./checkpoint-id";
import { Lock } from "./lock";
import {
  FirestoreStore,
  FirestoreTransaction,
  FirestoreTransactionPerformer,
} from "@ddd-ts/store-firestore";
import { ProjectionCheckpointStore } from "./checkpoint";
import { wait } from "./tools";
import { FieldValue } from "firebase-admin/firestore";
import { Shape } from "@ddd-ts/shape";
import { Handler } from "./handler/handler.spec";
import { Derive, HasTrait, ImplementsTrait } from "@ddd-ts/traits";

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

class AccountCashflowRenamedHandler extends Derive(
  Handler.Base,
  Handler.Suspense,
  Handler.BatchLast,
  Handler.Checkpoint,
  Handler.Transaction<FirestoreTransaction>(),
) {
  cashflowStore: FirestoreCashflowStore;
  constructor(props: {
    transaction: FirestoreTransactionPerformer;
    checkpointStore: any;
    cashflowStore: FirestoreCashflowStore;
  }) {
    super(props);
    this.cashflowStore = props.cashflowStore;
  }

  locks(event: AccountRenamed) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      type: "rename",
    });
  }

  async handleLast(event: AccountRenamed, context: this["context"]) {
    await this.cashflowStore.rename_transaction(
      event.payload.accountId,
      event.payload.newName,
      context.transaction,
    );
  }
}

class AccountCashflowOpenedHandler extends Derive(
  Handler.Base,
  Handler.Transaction<FirestoreTransaction>(),
  Handler.Checkpoint,
  Handler.Suspense,
  Handler.Parallel,
) {
  cashflowStore: FirestoreCashflowStore;
  constructor(props: {
    transaction: FirestoreTransactionPerformer;
    checkpointStore: any;
    cashflowStore: FirestoreCashflowStore;
  }) {
    super(props);
    this.cashflowStore = props.cashflowStore;
  }

  locks(event: AccountOpened) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
    });
  }

  async handleOne(event: AccountOpened, context: this["context"]) {
    await this.cashflowStore.init_transaction(
      event.payload.accountId,
      context.transaction,
    );
  }
}

class AccountCashflowDepositedHandler extends Derive(
  Handler.Base,
  Handler.Transaction<FirestoreTransaction>(),
  Handler.Checkpoint,
  Handler.Parallel,
  Handler.Suspense,
) {
  cashflowStore: FirestoreCashflowStore;
  constructor(props: {
    transaction: FirestoreTransactionPerformer;
    checkpointStore: any;
    cashflowStore: FirestoreCashflowStore;
  }) {
    super(props);
    this.cashflowStore = props.cashflowStore;
  }

  locks(event: Deposited) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      eventId: event.id.serialize(),
    });
  }

  async handleOne(event: Deposited, context: this["context"]) {
    await this.cashflowStore.increment_transaction(
      event.payload.accountId,
      event.payload.amount,
      context.transaction,
    );
  }
}

class AccountCashflowWithdrawnHandler extends Derive(
  Handler.Base,
  Handler.Transaction<FirestoreTransaction>(),
  Handler.Checkpoint,
  Handler.Parallel,
  Handler.Suspense,
) {
  cashflowStore: FirestoreCashflowStore;
  constructor(props: {
    transaction: FirestoreTransactionPerformer;
    checkpointStore: any;
    cashflowStore: FirestoreCashflowStore;
  }) {
    super(props);
    this.cashflowStore = props.cashflowStore;
  }

  locks(event: Withdrawn) {
    return new Lock({
      accountId: event.payload.accountId.serialize(),
      eventId: event.id.serialize(),
    });
  }

  async handleOne(event: Withdrawn, context: this["context"]) {
    await this.cashflowStore.increment_transaction(
      event.payload.accountId,
      event.payload.amount,
      context.transaction,
    );
  }
}

export class AccountCashflowProjection2 {
  handlers: {
    [AccountOpened.name]: AccountCashflowOpenedHandler;
    [Deposited.name]: AccountCashflowDepositedHandler;
    [Withdrawn.name]: AccountCashflowWithdrawnHandler;
    [AccountRenamed.name]: AccountCashflowRenamedHandler;
  };
  source = new AccountCashflowProjectedStream();
  constructor(
    private readonly transaction: FirestoreTransactionPerformer,
    private readonly checkpointStore: ProjectionCheckpointStore,
    public readonly cashflowStore: FirestoreCashflowStore = new FirestoreCashflowStore(
      checkpointStore.firestore,
    ),
  ) {
    this.handlers = {
      [AccountOpened.name]: new AccountCashflowOpenedHandler({
        cashflowStore: this.cashflowStore,
        transaction: this.transaction,
        checkpointStore: this.checkpointStore,
      }),
      [Deposited.name]: new AccountCashflowDepositedHandler({
        cashflowStore: this.cashflowStore,
        transaction: this.transaction,
        checkpointStore: this.checkpointStore,
      }),
      [Withdrawn.name]: new AccountCashflowWithdrawnHandler({
        cashflowStore: this.cashflowStore,
        transaction: this.transaction,
        checkpointStore: this.checkpointStore,
      }),
      [AccountRenamed.name]: new AccountCashflowRenamedHandler({
        cashflowStore: this.cashflowStore,
        transaction: this.transaction,
        checkpointStore: this.checkpointStore,
      }),
    };
  }

  getShardCheckpointId(
    event: AccountOpened | Deposited | Withdrawn | AccountRenamed,
  ) {
    return CheckpointId.from("AccountCashflow", event.payload.accountId);
  }

  suspend(
    event: IEsEvent,
  ): ReturnType<ImplementsTrait<typeof Handler.Suspense>["suspend"]> {
    const handler = (this.handlers as any)[event.name] as any;
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }
    return handler.suspend(event);
  }

  resume(
    event: IEsEvent,
  ): ReturnType<ImplementsTrait<typeof Handler.Suspense>["resume"]> {
    const handler = (this.handlers as any)[event.name] as any;
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }
    return handler.resume(event);
  }

  print(test: Function) {
    return `\n${Object.entries(this.handlers)
      .map(([name, handler]) => {
        const memory = handler.prettyMemory();
        if (memory.length === 0) {
          return "";
        }
        return `${name}: \n\t${handler.prettyMemory().join("\n\t")}`;
      })
      .filter(Boolean)
      .join("\n")}\n`
      .replaceAll("seed", "")
      .replaceAll(test.name, "")
      .replaceAll("--", "-");
  }

  async tick() {
    console.log("tick start");
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("tick end");
  }

  async process(checkpointId: CheckpointId, events: IEsEvent[]) {
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
      const handler = (this.handlers as any)[name] as any;

      if (!handler) {
        throw new Error(`No handler for event ${name}`);
      }

      const processed = await handler.process(events as any, { checkpointId });

      return processed.filter((e) => !!e);
    });

    const all = await Promise.all(promises);

    return all.flat() as EventId[];
  }
}
