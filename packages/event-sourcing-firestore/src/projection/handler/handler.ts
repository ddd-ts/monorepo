import {
  EventId,
  IEsEvent,
  Transaction,
  TransactionPerformer,
} from "@ddd-ts/core";
import { Derive, Subtrait, Trait } from "@ddd-ts/traits";
import { CheckpointId } from "../checkpoint-id";
import { Lock } from "../lock";
import { IdSet } from "../../idset";
import { StableEventId } from "../write";


// const log = console.log

const log = (...args: any[]) => {}


const BaseHandler = Trait((base) => {
  abstract class Handler extends base {
    declare context: {};
    abstract handle(
      events: IEsEvent[],
      context: this["context"],
    ): Promise<void>;

    abstract locks(event: IEsEvent): Lock;

    async process(events: IEsEvent[], context: {}): Promise<EventId[]> {
      log("BaseHandler.process before");
      await this.handle(events, context);
      log("BaseHandler.process after");
      return events.map((event) => event.id);
    }
  }
  return Handler;
});

const WithTransaction = <T extends Transaction>() =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithTransaction extends base {
      transaction: TransactionPerformer<T>;
      constructor(props: { transaction: TransactionPerformer<T> }) {
        super(props);
        this.transaction = props.transaction;
      }
      declare context: {
        transaction: T;
      };
      async process(events: IEsEvent[], context: {}) {
        log("WithTransaction.process before");
        await this.transaction.perform(async (trx) => {
          return super.process(events, { ...context, transaction: trx });
        });
        // await super.process(events, context);
        log("WithTransaction.process after");
        return events.map((event) => event.id);
      }
    }
    return WithTransaction;
  });

const WithSuspense = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithSuspense extends base {
    transaction: TransactionPerformer;
    constructor(props: { transaction: TransactionPerformer }) {
      super(props);
      this.transaction = props.transaction;
    }
    declare context: { transaction: Transaction };

    suspended = new Map<
      string,
      (suspension: { resume: () => void; fail: (err?: any) => void }) => void
    >();
    suspend(event: IEsEvent | EventId) {
      const eventId = "id" in event ? event.id : event;
      log(`WithSuspense.suspend: ${event}`);
      return new Promise<{ resume: () => void; fail: (err?: any) => void }>(
        (resolve) => {
          this.suspended.set(eventId.serialize(), resolve);
        },
      );
    }

    releases = new Map<
      string,
      { resolve: () => void; reject: (err: any) => void }
    >();
    resume(event: IEsEvent | EventId) {
      const eventId = "id" in event ? event.id : event;
      log(`WithSuspense.resume: ${event}`);
      const release = this.releases.get(eventId.serialize());
      if (release) {
        release.resolve();
        this.releases.delete(eventId.serialize());
      } else {
        console.warn(`WithSuspense.resume: no resume for ${event}`);
      }
      this.suspended.delete(eventId.serialize());
    }

    fail(event: IEsEvent | EventId, error?: any) {
      const eventId = "id" in event ? event.id : event;
      log(`WithSuspense.fail: ${event}`);
      const release = this.releases.get(eventId.serialize());
      if (release) {
        release.reject(error);
        this.releases.delete(eventId.serialize());
      } else {
        console.warn(`WithSuspense.fail: no release for ${event}`);
      }
      this.suspended.delete(eventId.serialize());
    }

    _intercept(event: IEsEvent): Promise<void> {
      return new Promise((resolve, reject) => {
        const suspender = this.suspended.get(event.id.serialize());

        if (suspender) {
          log(`WithSuspense.intercepted: ${event}`);
          this.releases.set(event.id.serialize(), { resolve, reject });
          suspender({
            resume: () => {
              this.resume(event);
            },
            fail: (error?: any) => {
              this.fail(event, error);
            },
          });
          return;
        }

        resolve();
      });
    }

    _memory: [IEsEvent, "before" | "after"][] = [];
    _remember_before(events: IEsEvent[]): void {
      this._memory.push(
        ...events.map(
          (event) => [event, "before"] as [IEsEvent, "before" | "after"],
        ),
      );
    }

    _remember_after(events: IEsEvent[]): void {
      for (const event of events) {
        const matching = this._memory.find(([e]) => e.id === event.id);
        if (matching) {
          matching[1] = "after";
        }
      }
    }

    prettyMemory() {
      return this._memory.map(([event, when]) => {
        return `${event} ${when}`.replace(StableEventId.globalseed, "seed");
      });
    }

    async process(events: IEsEvent[], context: {}) {
      log("WithSuspense.process before");
      this._remember_before(events);
      await Promise.all(events.map((event) => this._intercept(event)));
      await super.process(events, context);
      this._remember_after(events);
      log("WithSuspense.process after");
      return events.map((event) => event.id);
    }
  }
  return WithSuspense;
});

const WithCheckpoint = Subtrait([{} as typeof BaseHandler], (base) => {
  type CheckpointStore = {
    processed(
      checkpointId: CheckpointId,
      event: EventId[],
      context: { transaction?: Transaction },
    ): Promise<void>;
  };

  abstract class WithCheckpoint extends base {
    checkpointStore: CheckpointStore;
    constructor(props: {
      checkpointStore: CheckpointStore;
    }) {
      super(props);
      this.checkpointStore = props.checkpointStore;
    }

    declare context: { checkpointId: CheckpointId };

    async process(
      events: IEsEvent[],
      context: { checkpointId: CheckpointId; transaction?: Transaction },
    ) {
      log("WithCheckpoint.process before");
      await super.process(events, context);
      const ids = events.map((event) => event.id);
      log("WithCheckpoint.process after");
      await this.checkpointStore.processed(context.checkpointId, ids, context);
      log("WithCheckpoint.process done");
      return ids;
    }
  }
  return WithCheckpoint;
});

const WithParallel = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithParallel extends base {
    declare context: { checkpointId: CheckpointId };

    abstract handleOne(
      event: IEsEvent,
      context: this["context"],
    ): Promise<void>;

    async handle(events: IEsEvent[], context: this["context"]) {
      log("WithParallel.handle before");
      await Promise.all(events.map((event) => this.handleOne(event, context)));
      log("WithParallel.handle after");
    }

    async process(
      events: IEsEvent[],
      context: { checkpointId: CheckpointId; transaction?: Transaction },
    ) {
      log("WithParallel.process before");
      await Promise.all(events.map((event) => super.process([event], context)));
      log("WithParallel.process after");
      return events.map((event) => event.id);
    }
  }
  return WithParallel;
});

const WithBatchLast = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithBatchLast extends base {
    declare context: { checkpointId: CheckpointId };

    abstract handleLast(
      event: IEsEvent,
      context: this["context"],
    ): Promise<void>;

    async handle(events: IEsEvent[], context: this["context"]) {
      log("WithBatchLast.handle before");
      const last = events.at(-1);
      if (!last) {
        console.warn("WithBatchLast.handle called with no events");
        return;
      }
      await this.handleLast(last, context);
      log("WithBatchLast.handle after");
    }

    async process(
      events: IEsEvent[],
      context: { checkpointId: CheckpointId; transaction?: Transaction },
    ) {
      log("WithBatchLast.process before");
      await super.process(events, context);
      log("WithBatchLast.process after");
      return events.map((event) => event.id);
    }
  }
  return WithBatchLast;
});

export const Handler = {
  Base: BaseHandler,
  Transaction: WithTransaction,
  Suspense: WithSuspense,
  Checkpoint: WithCheckpoint,
  Parallel: WithParallel,
  BatchLast: WithBatchLast,
};
