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
// import { Lock } from "./lock";
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
//     await new Promise((resolve) => setTimeout(resolve, 50));
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

// class ClaimedAt {
//   constructor(public value: Date | "now") {}

//   static now() {
//     return new ClaimedAt("now");
//   }

//   static deserialize(value: Date | "now") {
//     return new ClaimedAt(value === "now" ? "now" : value);
//   }

//   serialize() {
//     return this.value;
//   }
// }

// class ProjectionStateId extends Primitive(String) {}

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
// }

// class Thread extends Shape({
//   last: Optional(Cursor),
//   tasks: Multiple({
//     cursor: Cursor,
//     lock: Lock,
//     previous: Optional(EventId),
//     processing: Boolean,
//     done: Boolean,
//   }),
// }) {
//   enqueue(cursor: Cursor, lock: Lock, previous?: EventId) {
//     const last = this.tasks.at(-1);

//     if (!previous) {
//       if (!last) {
//         throw new Error("Previous event is required when queue is not empty");
//       }
//       this.tasks.push({
//         cursor,
//         lock,
//         previous: undefined,
//         processing: false,
//         done: false,
//       });
//       return;
//     }

//     if (!last) {
//       throw new Error("Previous event is required when queue is not empty");
//     }

//     if (!last.cursor.eventId.equals(previous)) {
//       throw new Error(
//         `Previous event ${previous.serialize()} does not match last cursor ${last.cursor.eventId.serialize()}`,
//       );
//     }

//     this.tasks.push({ cursor, lock, previous, processing: false, done: false });
//   }

//   process(eventId: EventId) {
//     const claim = this.tasks.find((c) => c.cursor.eventId.equals(eventId));
//     if (!claim) {
//       throw new Error(`Event not found in thread: ${eventId}`);
//     }
//     claim.processing = true;
//   }

//   processed(eventId: EventId) {
//     const claim = this.tasks.find((c) => c.cursor.eventId.equals(eventId));
//     if (!claim) {
//       throw new Error(`Event not found in thread: ${eventId}`);
//     }

//     if (!claim.processing) {
//       throw new Error(`Event not processing: ${eventId}`);
//     }

//     claim.done = true;
//     claim.processing = false;
//     this.clean();
//   }

//   clean() {
//     for (const task of this.tasks) {
//       if (task.done) {
//         this.last = this.tasks.shift()?.cursor;
//       } else {
//         return;
//       }
//     }
//   }

//   getNextProcessable() {
//     const locks: Lock[] = [];

//     const batch: Cursor[] = [];

//     for (const task of this.tasks) {
//       if (locks.some((lock) => lock.restrains(task.lock))) {
//         locks.push(task.lock);
//         continue;
//       }

//       batch.push(task.cursor);
//     }

//     return batch;
//   }
// }

// class ProjectionCursor extends Shape({
//   eventId: EventId,
//   ref: EventReference,
//   occurredAt: Date,
//   revision: Number,
//   previous: Optional(EventId),
// }) {
//   isAfter(other: ProjectionCursor) {
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
//     return this.eventId.serialize() > other.eventId.serialize();
//   }

//   isBefore(other: ProjectionCursor) {
//     return !this.isAfter(other);
//   }

//   is(other: ProjectionCursor) {
//     return this.ref.serialize() === other.ref.serialize();
//   }

//   static fromFact(event: IEsEvent, previous?: EventId) {
//     return new ProjectionCursor({
//       eventId: event.id as EventId,
//       ref: (event as any).ref!,
//       occurredAt: event.occurredAt!,
//       revision: event.revision!,
//       previous: previous,
//     });
//   }

//   static sort(left: ProjectionCursor, right: ProjectionCursor) {
//     return left.isAfter(right) ? 1 : -1;
//   }
// }

// class ProjectionCursorLock extends Shape({
//   cursor: ProjectionCursor,
//   lock: Lock,
// }) {
//   nextOf(other: ProjectionCursorLock) {
//     return (
//       this.cursor.previous?.serialize() === other.cursor.eventId.serialize()
//     );
//   }

//   isAfter(other: ProjectionCursorLock) {
//     return this.cursor.isAfter(other.cursor);
//   }

//   isBefore(other: ProjectionCursorLock) {
//     return this.cursor.isBefore(other.cursor);
//   }

//   isSameCursor(other: ProjectionCursorLock) {
//     return this.cursor.is(other.cursor);
//   }

//   static sort(left: ProjectionCursorLock, right: ProjectionCursorLock) {
//     return ProjectionCursor.sort(left.cursor, right.cursor);
//   }
// }

// class ProjectionClaimThread extends Multiple(ProjectionCursorLock) {
//   has(eventId: Identifier) {
//     return this.some(
//       (claim) => claim.cursor.eventId.serialize() === eventId.serialize(),
//     );
//   }

//   get(eventId: EventId) {
//     return this.find(
//       (claim) => claim.cursor.eventId.serialize() === eventId.serialize(),
//     );
//   }

//   remove(eventId: EventId) {
//     const claim = this.get(eventId);
//     if (!claim) {
//       return;
//     }
//     this.splice(this.indexOf(claim), 1);
//     return claim;
//   }

//   claim(cursor: ProjectionCursorLock) {
//     for (const claim of this) {
//       if (claim.isSameCursor(cursor)) {
//         return "skip";
//       }

//       if (claim.isAfter(cursor)) {
//         // insert before
//         this.splice(this.indexOf(claim), 0, cursor);
//         return "claimed";
//       }
//     }

//     this.push(cursor);
//     return "claimed";
//   }

//   startsNextOf(other: ProjectionCursorLock) {
//     const tail = this.at(0);
//     if (!tail) {
//       return true;
//     }
//     return tail.nextOf(other);
//   }

//   getLastContinuousClaimed(lastProcessed: ProjectionCursorLock) {
//     const [tail, ...thread] = this;
//     if (!tail) {
//       return lastProcessed;
//     }

//     let last = lastProcessed;
//     for (const claim of this) {
//       if (claim.nextOf(last)) {
//         last = claim;
//       } else {
//         break;
//       }
//     }

//     return last;
//   }
// }

// class ProjectionCheckpoint extends Shape({
//   id: ProjectionCheckpointId,
//   count: Number,
//   claimed: ProjectionClaimThread,
//   done: [ProjectionCursorLock],
//   locks: IdMap(EventId, Lock),
//   processing: IdSet(EventId),
//   lastContinuousProcessed: Optional(ProjectionCursorLock),
// }) {
//   claim(event: IEsEvent, lock: Lock, previous?: EventId) {
//     if (this.claimed.has(event.id)) {
//       return "skip";
//     }

//     if (this.done.some((cursor) => cursor.cursor.eventId.equals(event.id))) {
//       return "skip";
//     }

//     if (this.processing.has(event.id)) {
//       return "skip";
//     }

//     for (const locks of this.locks.values()) {
//       if (locks.restrains(lock)) {
//         this.locks.set((event as any).id, lock);
//         return "skip";
//       }
//     }
//     const cursor = ProjectionCursor.fromFact(event, previous);

//     if (
//       this.lastContinuousProcessed &&
//       cursor.isBefore(this.lastContinuousProcessed?.cursor)
//     ) {
//       return "skip";
//     }

//     const claim = new ProjectionCursorLock({ cursor, lock });
//     const result = this.claimed.claim(claim);

//     if (result === "claimed") {
//       this.locks.set((event as any).id, lock);
//       return "claimed";
//     }

//     return "skip";
//   }

//   process(eventId: EventId) {
//     if (this.processing.has(eventId)) {
//       return false;
//     }
//     this.processing.add(eventId);
//     return true;
//   }

//   processed(eventId: EventId) {
//     const claim = this.claimed.remove(eventId);

//     this.processing.delete(eventId);
//     this.locks.delete(eventId);
//     if (!claim) {
//       throw new Error(`Event not found in claims: ${eventId}`);
//     }

//     if (!this.lastContinuousProcessed) {
//       this.lastContinuousProcessed = claim;
//       return;
//     }

//     if (claim.nextOf(this.lastContinuousProcessed)) {
//       this.lastContinuousProcessed = claim;
//       this.updateLastContinuousProcessed();
//       return;
//     }

//     this.done.push(claim);
//   }

//   updateLastContinuousProcessed(): void {
//     if (!this.lastContinuousProcessed) {
//       return;
//     }
//     const sorted = [...this.done].sort(ProjectionCursorLock.sort);

//     for (const done of sorted) {
//       if (done.nextOf(this.lastContinuousProcessed)) {
//         this.lastContinuousProcessed = done;
//         this.done = this.done.filter((d) => !d.isSameCursor(done));
//         this.updateLastContinuousProcessed();
//       }
//     }
//   }

//   getNextProcessable() {
//     for (const claim of this.claimed) {
//       if (this.processing.has(claim.cursor.eventId)) {
//         continue;
//       }
//       return claim.cursor;
//     }
//   }

//   getLastContinuousClaimed() {
//     const lastProcessed = this.lastContinuousProcessed;
//     if (!lastProcessed) {
//       return undefined;
//     }
//     return this.claimed.getLastContinuousClaimed(lastProcessed);
//   }

//   static initial(id: ProjectionCheckpointId) {
//     return new ProjectionCheckpoint({
//       id,
//       claimed: new ProjectionClaimThread([]),
//       locks: IdMap.for(EventId, Lock),
//       processing: IdSet.for(EventId),
//       done: [],
//       lastContinuousProcessed: undefined,
//       count: 0,
//     });
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

//     if (state.lastContinuousProcessed) {
//       const cursor = ProjectionCursor.fromFact(e);
//       if (
//         cursor.isBefore(state.lastContinuousProcessed.cursor) ||
//         cursor.is(state.lastContinuousProcessed.cursor)
//       ) {
//         console.log(
//           `Skipping event ${e.id.serialize()} as it is before or equal to the last processed cursor`,
//         );
//         return false;
//       }
//     }

//     const start = state.getLastContinuousClaimed();

//     const stream = this.reader.read(
//       this.projection.source,
//       accountId,
//       start?.cursor.ref,
//       until,
//     );

//     let previous = start?.cursor.eventId;

//     for await (const event of stream) {
//       const lock = this.projection.handlers[event.name].locks(event as any);

//       const result = await this.transaction.perform(async (trx) => {
//         const state = await this.store.expected(checkpointId, trx);

//         const result = state.claim(event, lock, previous);
//         await this.store.save(state, trx);
//         trx.onCommit(() => {
//           console.log(
//             `Followed event ${event.id.serialize()}: ${event.toString()}  ${result}`,
//           );
//         });
//         return result;
//       });

//       if (result === "claimed" && event.id.equals(e.id)) {
//         return true;
//       }

//       previous = event.id;
//     }

//     return false;
//   }

//   async process(checkpointId: ProjectionCheckpointId) {
//     const cursor = await this.transaction.perform(async (trx) => {
//       const state = await this.store.expected(checkpointId, trx);
//       const todo = state.getNextProcessable();
//       if (!todo) {
//         return;
//       }
//       if (state.process(todo.eventId)) {
//         await this.store.save(state, trx);
//         return todo;
//       }
//       return;
//     });

//     if (!cursor) {
//       return;
//     }

//     const e = await this.reader.get(cursor.ref);

//     const processed = await this.transaction.perform(async (trx) => {
//       const handler = this.projection.handlers[e.name];

//       const state = await this.store.expected(checkpointId, trx);
//       await handler.handle(e as any);
//       state.processed(cursor.eventId);
//       await this.store.save(state, trx);
//       return cursor;
//     });

//     return processed;
//   }

//   async handle(event: AccountOpened | Deposited | Withdrawn) {
//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       event.payload.accountId,
//     );

//     const success = await this.claim(event);
//     if (!success) {
//       await new Promise((resolve) => setTimeout(resolve, 100));
//       return this.handle(event);
//     }

//     const processed = await this.process(checkpointId);
//   }

//   async handle2(event: AccountOpened | Deposited | Withdrawn) {
//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       event.payload.accountId,
//     );

//     const accountId = event.payload.accountId.serialize();
//     const until = (event as any).ref;

//     await this.store.initialize(checkpointId);
//     const state = await this.store.expected(checkpointId);

//     const start = state.getLastContinuousClaimed();

//     const stream = this.reader.read(
//       this.projection.source,
//       accountId,
//       start?.cursor.ref,
//       until,
//     );

//     let previous = start?.cursor.eventId;

//     for await (const event of stream) {
//       const lock = this.projection.handlers[event.name].locks(event);

//       await this.transaction.perform(async (trx) => {
//         const state = await this.store.expected(checkpointId, trx);
//         const result = state.claim(event, lock, previous);
//         await this.store.save(state, trx);
//         trx.onCommit(() => {
//           console.log(
//             `Followed event ${event.id.serialize()}: ${event.toString()}  ${result}`,
//           );
//         });
//       });

//       // await this.tryClaim(event, lock); // Uncommenting this line to try claiming the event

//       // const result = await this.transaction.perform(async (trx) => {
//       //   const state = await this.store.expected(checkpointId, trx);

//       //   state.claim(event, lock, previous);
//       // });

//       // if (result === "full") {
//       //   console.log("Queue is full, deferring event", event.toString());
//       // }

//       previous = event.id;
//     }

//     console.log("Projector.handle:processing", event.toString());

//     await (async () => {
//       const cursor = await this.transaction.perform(async (trx) => {
//         const state = await this.store.expected(checkpointId, trx);
//         const todo = state.getNextProcessable();
//         if (!todo) {
//           return;
//         }
//         if (state.process(todo.eventId)) {
//           await this.store.save(state, trx);
//           return todo;
//         }
//         return;
//       });

//       if (!cursor) {
//         console.log("No cursor to process, waiting...");
//         await new Promise((resolve) => setTimeout(resolve, 100));
//         return this.handle(event);
//       }

//       const e = await this.reader.get(cursor.ref);

//       const processed = await this.transaction.perform(async (trx) => {
//         const handler = this.projection.handlers[e.name];

//         const state = await this.store.expected(checkpointId, trx);
//         await handler.handle(e as any);
//         state.processed(cursor.eventId);
//         await this.store.save(state, trx);
//         return cursor;
//       });

//       if (processed.eventId.serialize() !== event.id.serialize()) {
//         await new Promise((resolve) => setTimeout(resolve, 100));
//         return this.handle(e);
//       }
//       // const events = await Promise.all(state.claimed.map(value => this.reader.get(value.cursor.ref)));
//     })();

//     console.log("Projector.handle:end", event.toString());
//   }

//   // async step(shardId: AccountId) {
//   //   const checkpointId = this.projection.getShardCheckpointId(shardId);
//   //   const state = await this.store.expected(checkpointId);

//   //   const stream = this.reader.read(
//   //     this.projection.source,
//   //     shardId.serialize(),
//   //     state.tail?.ref,
//   //   );

//   //   for await (const event of stream) {
//   //     const lock = this.projection.handlers[event.name].locks(event);
//   //     await this.tryClaim(event, lock);
//   //   }
//   // }

//   // async tryClaim(event: AccountOpened | Deposited | Withdrawn, lock: Lock) {
//   //   const checkpointId = ProjectionCheckpointId.from(
//   //     "AccountCashflow",
//   //     event.payload.accountId,
//   //   );

//   //   const [result, state] = await this.transaction.perform(async (trx) => {
//   //     const state = await this.store.expected(checkpointId, trx);

//   //     if (state.shouldSkip(event)) {
//   //       return ["skip", state] as const;
//   //     }

//   //     if (state.canClaim(lock)) {
//   //       state.enqueue(event, lock);
//   //       await this.store.save(state, trx);
//   //       return ["process", state] as const;
//   //     }

//   //     return ["defer", state] as const;
//   //   });

//   //   console.log("tryClaim result", event.toString(), result, state.serialize());

//   //   if (result === "process") {
//   //     setImmediate(async () => {
//   //       const state = await this.store.expected(checkpointId);
//   //       const handling = this.projection.handlers[event.$name];
//   //       await handling.handle(event as any);
//   //       state.release(event.id);
//   //       await this.store.save(state);
//   //     });
//   //   } else if (result === "defer") {
//   //     console.log("Cannot claim lock", event.toString(), lock);
//   //     return this.defer(event, lock);
//   //   } else if (result === "skip") {
//   //     console.log("Skip event", event.toString());
//   //     return;
//   //   }
//   // }

//   // async defer(
//   //   event: AccountOpened | Deposited | Withdrawn,
//   //   lock: Lock,
//   // ): Promise<void> {
//   //   await new Promise((r) => setTimeout(r, 2000));
//   //   console.log("Event deferred:", event.toString());

//   //   return this.tryClaim(event, lock);
//   // }
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

// describe("Projection", () => {
//   class AccountStore extends MakeFirestoreEventStreamAggregateStore(Account) {
//     constructor(firestore: fb.firestore.Firestore, eventBus?: IEventBus) {
//       super(firestore, registry, eventBus);
//     }
//   }

//   class ProjectionStateSerializer extends AutoSerializer.First(
//     ProjectionCheckpoint,
//   ) {}

//   it("works", async () => {
//     const app = fb.initializeApp({ projectId: "demo-es" });
//     const firestore = app.firestore();

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

//     const projector = new Projector(
//       projection,
//       reader,
//       projectionStateStore,
//       new FirestoreTransactionPerformer(firestore),
//     );

//     const bankId = BankId.generate();

//     const [account, opened] = Account.open(bankId);
//     await accountStore.save(account);

//     const checkpointId = ProjectionCheckpointId.from(
//       "AccountCashflow",
//       account.id,
//     );

//     const handlingOpened = projector.handle(opened);
//     await projection.awaitSuspend(opened);
//     projection.resume(opened);
//     await projection.tick();
//     await handlingOpened;

//     console.log(
//       "After Opened Handled",
//       await projectionStateStore.load(checkpointId),
//     );

//     const deposit = account.deposit(100);
//     await accountStore.save(account);

//     const handlingDeposited = projector.handle(deposit);
//     await projection.awaitSuspend(deposit);
//     projection.resume(deposit);
//     await projection.tick();
//     await handlingDeposited;

//     console.log(
//       "After Deposited Handled",
//       await projectionStateStore.load(checkpointId),
//     );

//     console.log("projection state", projection.state);
//   });

//   it("works2", async () => {
//     const app = fb.initializeApp({ projectId: "demo-es" });
//     const firestore = app.firestore();

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

//     const projector = new Projector(
//       projection,
//       reader,
//       projectionStateStore,
//       new FirestoreTransactionPerformer(firestore),
//     );

//     eventBus.on(AccountOpened, (event) => projector.handle(event));
//     eventBus.on(Deposited, (event) => projector.handle(event));
//     eventBus.on(Withdrawn, (event) => projector.handle(event));

//     const bankId = BankId.generate();

//     const [account, opened] = Account.open(bankId);
//     const deposit = account.deposit(100);
//     await accountStore.save(account);

//     const flushing = eventBus.flushQueueParallel();

//     await projection.awaitSuspend(opened);
//     projection.resume(opened);

//     await projection.awaitSuspend(deposit);
//     projection.resume(deposit);

//     await flushing;

//     expect(projection.state).toEqual({});
//   });
// });

// if (process.env.DEBUG) {
//   jest.setTimeout(100_000);
// } else {
//   jest.setTimeout(10_000);
// }
