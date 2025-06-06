// process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
// import * as fb from "firebase-admin";

// import {
//   AutoSerializer,
//   DetachedEventBus,
//   EsAggregate,
//   EsEvent,
//   EventId,
//   EventReference,
//   EventsOf,
//   Identifier,
//   IEsEvent,
//   IEvent,
//   IEventBus,
//   NamedShape,
//   On,
//   ProjectedStream,
//   ProjectedStreamReader,
//   Projection,
//   Queue,
//   SerializerRegistry,
//   StreamSource,
// } from "@ddd-ts/core";
// import {
//   Choice,
//   Mapping,
//   Multiple,
//   Optional,
//   Primitive,
//   Shape,
// } from "../../shape/dist";
// import { MakeFirestoreEventStreamAggregateStore } from "./firestore.event-stream.aggregate-store";
// import { FirestoreProjectedStreamReader } from "./firestore.projected-stream.reader";
// import { IdMap } from "./idmap";
// import { Constructor } from "@ddd-ts/types";
// import {
//   FirestoreStore,
//   FirestoreTransaction,
//   FirestoreTransactionPerformer,
// } from "@ddd-ts/store-firestore";
// import { Firestore } from "firebase-admin/firestore";
// import { Lock } from "./projection/lock";
// import { IdSet } from "./idset";

// class AccountId extends Primitive(String) {
//   static generate() {
//     return new AccountId(`A${EventId.generate().serialize().slice(0, 8)}`);
//   }
// }

// class BankId extends Primitive(String) {
//   static generate() {
//     return new BankId(`B${EventId.generate().serialize().slice(0, 8)}`);
//   }
// }

// class AccountOpened extends EsEvent("AccountOpened", {
//   accountId: AccountId,
//   bankId: BankId,
// }) {
//   toString() {
//     return `Account<${this.payload.accountId.serialize()}>:Opened()`;
//   }
// }

// class Deposited extends EsEvent("Deposited", {
//   bankId: BankId,
//   accountId: AccountId,
//   amount: Number,
// }) {
//   toString() {
//     return `Account<${this.payload.accountId.serialize()}>:Deposited(${this.payload.amount})`;
//   }
// }

// class Withdrawn extends EsEvent("Withdrawn", {
//   bankId: BankId,
//   accountId: AccountId,
//   amount: Number,
// }) {
//   toString() {
//     return `Account<${this.payload.accountId.serialize()}>:Withdrawn(${this.payload.amount})`;
//   }
// }

// class Account extends EsAggregate("Account", {
//   events: [AccountOpened, Deposited, Withdrawn],
//   state: {
//     id: AccountId,
//     bankId: BankId,
//     balance: Number,
//   },
// }) {
//   static open(bankId: BankId) {
//     const accountId = AccountId.generate();
//     const change = AccountOpened.new({ accountId, bankId });
//     const instance = this.new(change);
//     return [instance, change] as const;
//   }

//   @On(AccountOpened)
//   static onOpened(event: AccountOpened) {
//     return new Account({
//       id: event.payload.accountId,
//       bankId: event.payload.bankId,
//       balance: 0,
//     });
//   }

//   deposit(amount: number) {
//     const change = Deposited.new({
//       accountId: this.id,
//       amount,
//       bankId: this.bankId,
//     });
//     this.apply(change);
//     return change;
//   }

//   @On(Deposited)
//   onDeposited(event: Deposited) {
//     this.balance += event.payload.amount;
//   }

//   withdraw(amount: number) {
//     const change = Withdrawn.new({
//       accountId: this.id,
//       amount,
//       bankId: this.bankId,
//     });
//     this.apply(change);
//     return change;
//   }

//   @On(Withdrawn)
//   onWithdrawn(event: Withdrawn) {
//     this.balance -= event.payload.amount;
//   }
// }

// class BankCreated extends EsEvent("BankCreated", {
//   bankId: BankId,
// }) {}

// class AccountRegistered extends EsEvent("AccountRegistered", {
//   accountId: AccountId,
//   bankId: BankId,
// }) {}

// class AccountUnregistered extends EsEvent("AccountUnregistered", {
//   accountId: AccountId,
//   bankId: BankId,
// }) {}

// class Bank extends EsAggregate("Bank", {
//   events: [BankCreated, AccountRegistered, AccountUnregistered],
//   state: {
//     id: BankId,
//     accounts: [AccountId],
//   },
// }) {
//   static create() {
//     const bankId = BankId.generate();
//     return this.new(BankCreated.new({ bankId }));
//   }

//   @On(BankCreated)
//   static onCreated(event: BankCreated) {
//     return new Bank({
//       id: event.payload.bankId,
//       accounts: [],
//     });
//   }

//   registerAccount(accountId: AccountId) {
//     return this.apply(AccountRegistered.new({ accountId, bankId: this.id }));
//   }

//   @On(AccountRegistered)
//   onAccountRegistered(event: AccountRegistered) {
//     this.accounts.push(event.payload.accountId);
//   }

//   unregisterAccount(accountId: AccountId) {
//     return this.apply(AccountUnregistered.new({ accountId, bankId: this.id }));
//   }

//   @On(AccountUnregistered)
//   onAccountUnregistered(event: AccountUnregistered) {
//     this.accounts = this.accounts.filter(
//       (id) => id !== event.payload.accountId,
//     );
//   }
// }

// const registry = new SerializerRegistry()
//   .auto(AccountOpened)
//   .auto(Deposited)
//   .auto(Withdrawn)
//   .auto(BankCreated)
//   .auto(AccountRegistered)
//   .auto(AccountUnregistered)
//   .auto(Account)
//   .auto(Bank);

// class AccountCashflowProjectedStream extends ProjectedStream {
//   constructor() {
//     super({
//       sources: [
//         new StreamSource({
//           aggregateType: Account.name,
//           shardKey: "accountId",
//           events: [AccountOpened.name, Deposited.name, Withdrawn.name],
//         }),
//       ],
//     });
//   }
// }

// class AccountCashflowProjection {
//   state: Record<string, number> = {};

//   getShardCheckpointId(accountId: AccountId) {
//     return ProjectionCheckpointId.from("AccountCashflow", accountId);
//   }

//   source = new AccountCashflowProjectedStream();

//   awaiters = new Map<string, Set<(value: any) => void>>();

//   suspended = new Map<string, Set<(value: any) => void>>();
//   suspend(event: IEsEvent) {
//     return new Promise((resolve) => {
//       const resolvers = this.suspended.get(event.id.serialize()) || new Set();
//       resolvers.add(resolve);
//       this.suspended.set(event.id.serialize(), resolvers);
//       for (const [key, value] of this.awaiters.entries()) {
//         if (key === event.id.serialize()) {
//           // biome-ignore lint/complexity/noForEach: <explanation>
//           value.forEach((resolve) => resolve(undefined));
//           this.awaiters.delete(key);
//         }
//       }
//     });
//   }

//   isSuspended(event: IEsEvent) {
//     return this.suspended.has(event.id.serialize());
//   }

//   resume(event: IEsEvent) {
//     const resolvers = this.suspended.get(event.id.serialize());
//     if (resolvers) {
//       // biome-ignore lint/complexity/noForEach: <explanation>
//       resolvers.forEach((resolve) => resolve(undefined));
//       this.suspended.delete(event.id.serialize());
//     }
//   }

//   async awaitSuspend(event: IEsEvent) {
//     return new Promise((resolve) => {
//       const resolvers = this.awaiters.get(event.id.serialize()) || new Set();
//       resolvers.add(resolve);
//       this.awaiters.set(event.id.serialize(), resolvers);
//     });
//   }

//   async tick() {
//     console.log("tick start");
//     await new Promise((resolve) => setTimeout(resolve, 100));
//     console.log("tick end");
//   }

//   handlers = {
//     [AccountOpened.name]: {
//       handle: async (event: AccountOpened) => {
//         console.log("before suspend", event.toString());
//         await this.suspend(event);
//         console.log("after suspend", event.toString());
//         if (this.state[event.payload.accountId.serialize()] !== undefined) {
//           throw new Error("Account already opened");
//         }
//         this.state[event.payload.accountId.serialize()] = 0;
//       },
//       locks: (event: AccountOpened) => {
//         return new Lock({
//           accountId: event.payload.accountId.serialize(),
//         });
//       },
//     },
//     [Deposited.name]: {
//       handle: async (event: Deposited) => {
//         console.log("before suspend", event.toString());
//         await this.suspend(event);
//         console.log("after suspend", event.toString());
//         if (this.state[event.payload.accountId.serialize()] === undefined) {
//           throw new Error("Account not opened");
//         }
//         this.state[event.payload.accountId.serialize()] += event.payload.amount;
//       },
//       locks: (event: Deposited) => {
//         return new Lock({
//           accountId: event.payload.accountId.serialize(),
//           eventId: event.id.serialize(),
//         });
//       },
//     },
//     [Withdrawn.name]: {
//       handle: async (event: Withdrawn) => {
//         console.log("before suspend", event.toString());
//         await this.suspend(event);
//         console.log("after suspend", event.toString());
//         if (this.state[event.payload.accountId.serialize()] === undefined) {
//           throw new Error("Account not opened");
//         }
//         this.state[event.payload.accountId.serialize()] += event.payload.amount;
//       },
//       locks: (event: Withdrawn) => {
//         return new Lock({
//           accountId: event.payload.accountId.serialize(),
//           eventId: event.id.serialize(),
//         });
//       },
//     },
//   };

//   onDeposited(event: Deposited) {
//     this.state[event.payload.accountId.serialize()] += event.payload.amount;
//   }

//   onWithdrawn(event: Withdrawn) {
//     this.state[event.payload.accountId.serialize()] -= event.payload.amount;
//   }
// }

// class ProjectionCheckpointId extends Shape(String) {
//   static separator = "@@";

//   static from(name: string, shardValue: { serialize: () => string }) {
//     const id = `${name}${ProjectionCheckpointId.separator}${shardValue.serialize()}`;
//     return new ProjectionCheckpointId(id);
//   }
// }

// class Cursor extends Shape({
//   occurredAt: Date,
//   revision: Number,
//   ref: EventReference,
//   eventId: EventId,
// }) {
//   isAfterOrEqual(other: Cursor) {
//     return this.is(other) || this.isAfter(other);
//   }

//   isAfter(other: Cursor) {
//     if (this.occurredAt < other.occurredAt) {
//       return false;
//     }
//     if (this.occurredAt > other.occurredAt) {
//       return true;
//     }
//     if (this.revision < other.revision) {
//       return false;
//     }
//     if (this.revision > other.revision) {
//       return true;
//     }
//     return this.ref.serialize() > other.ref.serialize();
//   }

//   isBefore(other: Cursor) {
//     return !this.isAfter(other);
//   }

//   is(other: Cursor) {
//     return this.ref.serialize() === other.ref.serialize();
//   }

//   static from(event: IEsEvent) {
//     return new Cursor({
//       occurredAt: (event as any).occurredAt,
//       revision: (event as any).revision,
//       ref: (event as any).ref,
//       eventId: event.id,
//     });
//   }

//   toString() {
//     return `${this.ref.serialize()}`;
//   }
// }

// class EventStatus extends Choice(["processing", "done"]) {}

// class Thread extends Shape({
//   tail: Optional(Cursor),
//   head: Optional(Cursor),
//   tasks: Multiple({
//     cursor: Cursor,
//     lock: Lock,
//     previous: Optional(EventId),
//     // done: Boolean,
//   }),
//   statuses: IdMap(EventId, EventStatus),
// }) {
//   enqueue(cursor: Cursor, lock: Lock, previous?: EventId) {
//     const head = this.head;

//     if (head?.isAfterOrEqual(cursor)) {
//       return;
//     }

//     if (!previous) {
//       if (head) {
//         // if(head.)
//         // throw new Error(
//         //   "Cannot enqueue without previous event when queue is not empty",
//         // );
//         return;
//       }

//       this.tasks.push({
//         cursor,
//         lock,
//         previous: undefined,
//       });
//       this.head = cursor;
//       return;
//     }

//     if (!head) {
//       throw new Error("Previous event is required when queue is not empty");
//     }

//     if (!head.eventId.equals(previous)) {
//       throw new Error(
//         `Previous event ${previous.serialize()} does not match last cursor ${head.eventId.serialize()}`,
//       );
//     }

//     this.tasks.push({ cursor, lock, previous });
//     this.head = cursor;
//   }

//   process(eventId: EventId) {
//     const claim = this.tasks.find((c) => c.cursor.eventId.equals(eventId));
//     if (!claim) {
//       throw new Error(`Event not found in thread: ${eventId}`);
//     }
//     this.statuses.set(eventId, EventStatus.processing());
//   }

//   processed(eventId: EventId) {
//     const claim = this.tasks.find((c) => c.cursor.eventId.equals(eventId));
//     if (!claim) {
//       throw new Error(`Event not found in thread: ${eventId}`);
//     }

//     this.statuses.set(eventId, EventStatus.done());
//     this.clean();
//   }

//   clean() {
//     for (const task of [...this.tasks]) {
//       const status = this.statuses.get(task.cursor.eventId);
//       if (!status?.is("done")) {
//         return;
//       }
//       this.tail = this.tasks.shift()?.cursor;
//     }
//   }

//   startNextBatch() {
//     const locks: Lock[] = [];
//     const batch: Cursor[] = [];

//     for (const task of this.tasks) {
//       if (locks.some((lock) => lock.restrains(task.lock))) {
//         continue;
//       }
//       locks.push(task.lock);

//       const status = this.statuses.get(task.cursor.eventId);
//       if (status) continue;

//       batch.push(task.cursor);
//       this.statuses.set(task.cursor.eventId, EventStatus.processing());
//     }

//     return batch;
//   }

//   toString() {
//     return [
//       `\tHEAD: ${this.head}`,
//       ...this.tasks.map(
//         (task) =>
//           `\t\t${task.cursor.ref.serialize()} ${this.statuses.get(task.cursor.eventId)?.serialize()}`,
//       ),
//       `\tTAIL: ${this.tail}`,
//     ].join("\n");
//   }
// }

// class ProjectionCheckpoint extends Shape({
//   id: ProjectionCheckpointId,
//   thread: Thread,
// }) {
//   isTailAfterOrEqual(cursor: Cursor) {
//     return this.thread.tail?.isAfterOrEqual(cursor) ?? false;
//   }

//   enqueue(event: IEsEvent, lock: Lock, previous?: EventId) {
//     this.thread.enqueue(Cursor.from(event), lock, previous);
//   }

//   process(eventId: EventId) {
//     this.thread.process(eventId);
//   }

//   processed(eventId: EventId) {
//     this.thread.processed(eventId);
//   }

//   static initial(id: ProjectionCheckpointId) {
//     return new ProjectionCheckpoint({
//       id,
//       thread: new Thread({
//         tail: undefined,
//         head: undefined,
//         tasks: [],
//         statuses: IdMap.for(EventId, EventStatus),
//       }),
//     });
//   }

//   toString() {
//     return this.thread.toString();
//   }
// }
// class ProjectionStateStore extends FirestoreStore<ProjectionCheckpoint> {
//   async initialize(id: ProjectionCheckpointId) {
//     const existing = await this.load(id);
//     if (existing) {
//       return;
//     }

//     const serialized = await this.serializer.serialize(
//       ProjectionCheckpoint.initial(id),
//     );

//     await this.collection
//       .doc(id.serialize())
//       .create(serialized)
//       .catch((e) => {
//         if (e.code === 6) {
//           return;
//         }
//         throw e;
//       });
//   }

//   async expected(id: ProjectionCheckpointId, trx?: FirestoreTransaction) {
//     const existing = await this.load(id, trx);
//     if (!existing) {
//       throw new Error(`Projection state not found: ${id}`);
//     }
//     return existing;
//   }

//   async processed(
//     id: ProjectionCheckpointId,
//     eventId: EventId,
//     trx?: FirestoreTransaction,
//   ) {
//     if (trx) {
//       return trx.transaction.update(this.collection.doc(id.serialize()), {
//         [`thread.statuses.${eventId.serialize()}`]: "done",
//       });
//     }

//     await this.collection.doc(id.serialize()).update({
//       [`thread.statuses.${eventId.serialize()}`]: "done",
//     });

//     return;
//   }
// }

// class Projector {
//   constructor(
//     public readonly projection: AccountCashflowProjection,
//     public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
//     public readonly store: ProjectionStateStore,
//     public readonly transaction: FirestoreTransactionPerformer,
//   ) {}

//   async claim(e: IEsEvent): Promise<boolean> {
//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       e.payload.accountId,
//     );

//     const accountId = e.payload.accountId.serialize();
//     const until = (e as any).ref;

//     await this.store.initialize(checkpointId);
//     const state = await this.store.expected(checkpointId);

//     const cursor = Cursor.from(e);

//     if (state.thread.tail && cursor.isAfterOrEqual(state.thread.tail)) {
//       console.log(
//         `Skipping event ${e.id.serialize()} as it is after the last cursor ${state.thread.tail.ref.serialize()}`,
//       );
//       return false;
//     }

//     const stream = this.reader.read(
//       this.projection.source,
//       accountId,
//       state.thread.tail?.ref,
//       until,
//     );

//     let previous = state.thread.tail?.eventId;

//     for await (const event of stream) {
//       const lock = this.projection.handlers[event.name].locks(event as any);

//       await this.transaction.perform(async (trx) => {
//         const state = await this.store.expected(checkpointId, trx);

//         state.enqueue(event, lock, previous);
//         await this.store.save(state, trx);
//       });

//       previous = event.id;
//     }

//     return false;
//   }

//   async process(event: IEsEvent): Promise<any> {
//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       event.payload.accountId,
//     );

//     const batch = await this.transaction.perform(async (trx) => {
//       const state = await this.store.expected(checkpointId, trx);
//       state.thread.clean();
//       if (state.isTailAfterOrEqual(Cursor.from(event))) {
//         return false;
//       }
//       const batch = state.thread.startNextBatch();
//       await this.store.save(state, trx);
//       return batch;
//     });

//     if (!batch) {
//       console.log(
//         `Skipping event ${event.id.serialize()} as it is after the last cursor`,
//       );
//       return;
//     }

//     const events = await Promise.all(
//       batch.map((cursor) => this.reader.get(cursor.ref)),
//     );

//     await Promise.all(
//       events.map(async (event) => {
//         const handler = this.projection.handlers[event.name];
//         if (!handler) {
//           throw new Error(`No handler for event ${event.name}`);
//         }
//         await this.transaction.perform(async (trx) => {
//           await handler.handle(event as any);
//           await this.store.processed(checkpointId, event.id, trx);
//         });
//       }),
//     );

//     if (batch.some((b) => b.eventId.equals(event.id))) {
//       console.log(`Batch contained target event ${event}`);
//       return true;
//     }

//     console.log(`Batch did not contain target event ${event}`);
//     await new Promise((resolve) => setTimeout(resolve, 100));
//     return this.process(event);
//     // return false;
//   }

//   async handle(event: AccountOpened | Deposited | Withdrawn) {
//     console.log(`Projector: handling event ${event.toString()}`);
//     await this.claim(event);
//     console.log(`Projector: claimed event ${event.toString()}`);
//     await this.process(event);
//     console.log(`Projector: processed event ${event.toString()}`);
//   }
// }

// type EventHandlerFn<E extends IEvent> = (event: E) => Promise<void>;

// class QueuedSequentialInMemoryEventBus implements IEventBus {
//   events: IEvent[] = [];
//   handlers = new Map<string, Set<EventHandlerFn<IEvent>>>();

//   async flushQueueParallel() {
//     const events = this.events;
//     this.events = [];
//     return Promise.all(
//       events.map((event) => {
//         const handlers = this.handlers.get(event.name);
//         if (handlers) {
//           return Promise.all(
//             [...handlers].map(async (handler) => {
//               console.log(
//                 `EB: before handler ${handler.name} for ${event.name}`,
//               );

//               await handler(event as any);
//               console.log(
//                 `EB: after handler ${handler.name} for ${event.name}`,
//               );
//             }),
//           );
//         }
//         return Promise.resolve();
//       }),
//     );
//   }

//   on<T extends IEvent>(key: Constructor<T>, cb: EventHandlerFn<T>): void {
//     const handlers =
//       this.handlers.get(key.name) || new Set<EventHandlerFn<T>>();

//     handlers.add(cb);

//     this.handlers.set(key.name, handlers as any);
//   }

//   off<T extends IEvent>(key: Constructor<T>, cb: EventHandlerFn<T>): void {
//     this.handlers.get(key.name)?.delete(cb as any);
//   }

//   async publish(event: IEvent) {
//     this.events.push(event);
//   }
// }

// class SimpleHandler {
//   constructor(
//     public readonly store: ProjectionStateStore,
//     public readonly transaction: FirestoreTransactionPerformer,
//     public readonly projection: AccountCashflowProjection,
//   ) {}

//   async *handle(
//     checkpointId: ProjectionCheckpointId,
//     events: AsyncIterable<IEsEvent>,
//   ) {
//     for await (const event of events) {
//       yield this.transaction.perform(async (trx) => {
//         const state = await this.store.expected(checkpointId, trx);
//         const handler = this.projection.handlers[event.name];
//         if (!handler) {
//           throw new Error(`No handler for event ${event.name}`);
//         }
//         await handler.handle(event as any);
//         await this.store.save(state, trx);
//       });
//     }
//   }
// }

// // class BatchHandler {
// //   constructor(
// //     public readonly store: ProjectionStateStore,
// //     public readonly transaction: FirestoreTransactionPerformer,
// //     public readonly projection: AccountCashflowProjection,
// //   ) {}

// //   async *handle(
// //     checkpointId: ProjectionCheckpointId,
// //     events: AsyncIterable<IEsEvent>,
// //   ) {
// //     for await (const event of events) {
// //       yield this.transaction.perform(async (trx) => {
// //         const state = await this.store.expected(checkpointId, trx);
// //         const handler = this.projection.handlers[event.name];
// //         if (!handler) {
// //           throw new Error(`No handler for event ${event.name}`);
// //         }
// //         await handler.handle(event as any);
// //         await this.store.save(state, trx);
// //       });
// //     }
// //   }
// // }

// describe("Projection", () => {
//   class AccountStore extends MakeFirestoreEventStreamAggregateStore(Account) {
//     constructor(firestore: fb.firestore.Firestore, eventBus?: IEventBus) {
//       super(firestore, registry, eventBus);
//     }
//   }

//   class ProjectionStateSerializer extends AutoSerializer.First(
//     ProjectionCheckpoint,
//   ) {}

//   const app = fb.initializeApp({ projectId: "demo-es" });
//   const firestore = app.firestore();

//   function prepare() {
//     const eventBus = new QueuedSequentialInMemoryEventBus();

//     const reader = new FirestoreProjectedStreamReader<
//       AccountOpened | Deposited | Withdrawn
//     >(firestore, registry);
//     const accountStore = new AccountStore(firestore, eventBus);

//     const projection = new AccountCashflowProjection();

//     const projectionStateStore = new ProjectionStateStore(
//       firestore.collection("projection"),
//       new ProjectionStateSerializer(),
//     );
//     const performer = new FirestoreTransactionPerformer(firestore);

//     (performer as any).createTransaction = (effect: any) =>
//       firestore.runTransaction((trx) => effect(new FirestoreTransaction(trx)), {
//         maxAttempts: 5,
//       });

//     const projector = new Projector(
//       projection,
//       reader,
//       projectionStateStore,
//       performer,
//     );

//     return {
//       app,
//       firestore,
//       eventBus,
//       reader,
//       accountStore,
//       projection,
//       projectionStateStore,
//       projector,
//     };
//   }

//   it("single event", async () => {
//     const { accountStore, projection, projectionStateStore, projector } =
//       prepare();

//     const bankId = BankId.generate();

//     const [account, opened] = Account.open(bankId);
//     await accountStore.save(account);

//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       account.id,
//     );

//     projector.handle(opened);

//     await projection.awaitSuspend(opened);
//     projection.resume(opened);

//     await projection.tick();

//     const stateAfter = await projectionStateStore.load(checkpointId);

//     stateAfter?.thread.clean();
//     expect(stateAfter?.thread.tasks).toHaveLength(0);
//     expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);

//     expect(projection.state[account.id.serialize()]).toEqual(0);
//   });

//   it("wait for AccountOpened to deposit", async () => {
//     const { accountStore, projection, projectionStateStore, projector } =
//       prepare();

//     const bankId = BankId.generate();

//     const [account, opened] = Account.open(bankId);
//     const deposit = account.deposit(100);
//     await accountStore.save(account);

//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       account.id,
//     );

//     projector.handle(deposit);

//     await projection.awaitSuspend(opened);
//     expect(projection.isSuspended(opened)).toBe(true);
//     expect(projection.isSuspended(deposit)).toBe(false);
//     projection.resume(opened);

//     await projection.awaitSuspend(deposit);
//     expect(projection.isSuspended(opened)).toBe(false);
//     expect(projection.isSuspended(deposit)).toBe(true);
//     projection.resume(deposit);

//     await projection.tick();
//     expect(projection.isSuspended(opened)).toBe(false);
//     expect(projection.isSuspended(deposit)).toBe(false);

//     expect(projection.state[account.id.serialize()]).toEqual(100);

//     const stateAfter = await projectionStateStore.load(checkpointId);

//     stateAfter?.thread.clean();
//     expect(stateAfter?.thread.tasks).toHaveLength(0);
//     expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);
//   });

//   it("allows concurrency on deposits and withdrawals", async () => {
//     const { accountStore, projection, projectionStateStore, projector } =
//       prepare();

//     const bankId = BankId.generate();

//     const [account, opened] = Account.open(bankId);
//     const deposit = account.deposit(100);
//     const withdraw = account.withdraw(50);
//     await accountStore.save(account);

//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       account.id,
//     );

//     projector.handle(withdraw);

//     await projection.awaitSuspend(opened);
//     expect(projection.isSuspended(opened)).toBe(true);
//     expect(projection.isSuspended(deposit)).toBe(false);
//     expect(projection.isSuspended(withdraw)).toBe(false);
//     projection.resume(opened);
//     await projection.tick();

//     await Promise.all([
//       projection.awaitSuspend(deposit),
//       projection.awaitSuspend(withdraw),
//     ]);
//     expect(projection.isSuspended(opened)).toBe(false);
//     expect(projection.isSuspended(deposit)).toBe(true);
//     expect(projection.isSuspended(withdraw)).toBe(true);
//     projection.resume(deposit);
//     projection.resume(withdraw);
//     await projection.tick();

//     expect(projection.isSuspended(opened)).toBe(false);
//     expect(projection.isSuspended(deposit)).toBe(false);

//     expect(projection.state[account.id.serialize()]).toEqual(150);

//     const stateAfter = await projectionStateStore.load(checkpointId);

//     stateAfter?.thread.clean();
//     expect(stateAfter?.thread.tasks).toHaveLength(0);
//     expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);
//   });

//   it("resists handling duplicate events", async () => {
//     const { accountStore, projection, projectionStateStore, projector } =
//       prepare();

//     const bankId = BankId.generate();

//     const [account, opened] = Account.open(bankId);
//     const deposit = account.deposit(100);
//     const withdraw = account.withdraw(50);
//     await accountStore.save(account);

//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       account.id,
//     );

//     projector.handle(withdraw);
//     projector.handle(withdraw);

//     await projection.awaitSuspend(opened);
//     expect(projection.isSuspended(opened)).toBe(true);
//     expect(projection.isSuspended(deposit)).toBe(false);
//     expect(projection.isSuspended(withdraw)).toBe(false);
//     projection.resume(opened);
//     await projection.tick();

//     await Promise.all([
//       projection.awaitSuspend(deposit),
//       projection.awaitSuspend(withdraw),
//     ]);
//     expect(projection.isSuspended(opened)).toBe(false);
//     expect(projection.isSuspended(deposit)).toBe(true);
//     expect(projection.isSuspended(withdraw)).toBe(true);
//     projection.resume(deposit);
//     projection.resume(withdraw);
//     await projection.tick();

//     expect(projection.isSuspended(opened)).toBe(false);
//     expect(projection.isSuspended(deposit)).toBe(false);

//     expect(projection.state[account.id.serialize()]).toEqual(150);

//     const stateAfter = await projectionStateStore.load(checkpointId);

//     console.log(stateAfter?.toString());
//     stateAfter?.thread.clean();
//     console.log(stateAfter?.toString());

//     expect(stateAfter?.thread.tasks).toHaveLength(0);
//     expect(stateAfter?.thread.head).toEqual(stateAfter?.thread.tail);
//   });

//   /**
//    * TODO:
//    * - ensure that events can only be flagged as processing once
//    * - ensure that events can only be flagged as done once
//    * - ensure that the same event published twice wont cause issues
//    *
//    *
//    */

//   // it("works2", async () => {
//   //   const app = fb.initializeApp({ projectId: "demo-es" });
//   //   const firestore = app.firestore();

//   //   const eventBus = new QueuedSequentialInMemoryEventBus();

//   //   const reader = new FirestoreProjectedStreamReader<
//   //     AccountOpened | Deposited | Withdrawn
//   //   >(firestore, registry);
//   //   const accountStore = new AccountStore(firestore, eventBus);

//   //   const projection = new AccountCashflowProjection();

//   //   const projectionStateStore = new ProjectionStateStore(
//   //     firestore.collection("projection"),
//   //     new ProjectionStateSerializer(),
//   //   );

//   //   const projector = new Projector(
//   //     projection,
//   //     reader,
//   //     projectionStateStore,
//   //     new FirestoreTransactionPerformer(firestore),
//   //   );

//   //   eventBus.on(AccountOpened, (event) => projector.handle(event));
//   //   eventBus.on(Deposited, (event) => projector.handle(event));
//   //   eventBus.on(Withdrawn, (event) => projector.handle(event));

//   //   const bankId = BankId.generate();

//   //   const [account, opened] = Account.open(bankId);
//   //   const deposit = account.deposit(100);
//   //   await accountStore.save(account);

//   //   const flushing = eventBus.flushQueueParallel();

//   //   await projection.awaitSuspend(opened);
//   //   projection.resume(opened);

//   //   await projection.awaitSuspend(deposit);
//   //   projection.resume(deposit);

//   //   await flushing;

//   //   expect(projection.state).toEqual({});
//   // });
// });

// if (process.env.DEBUG) {
//   jest.setTimeout(100_000);
// } else {
//   jest.setTimeout(10_000);
// }
