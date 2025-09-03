import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { IEsEvent } from "../../interfaces/es-event";
import { EventId } from "../../components/event-id";
import {
  Transaction,
  TransactionPerformer,
} from "../../components/transaction";
import { Description } from "./description";

export const WithSuspense = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithSuspense extends base {
    declare description: Description<{
      name: "withSuspense";
      before_process: "block if an event is suspended";
    }>;

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

      return new Promise<{ resume: () => void; fail: (err?: any) => void }>(
        (resolve: any, reject: any) => {
          const timeout = setTimeout(() => {
            reject(new Error(`WithSuspense.suspend timed out for ${event}`));
          }, 10_000);

          this.suspended.set(eventId.serialize(), (suspension) => {
            clearTimeout(timeout);
            resolve(suspension);
          });
        },
      );
    }

    releases = new Map<
      string,
      { resolve: () => void; reject: (err: any) => void }
    >();

    resume(event: IEsEvent | EventId) {
      const eventId = "id" in event ? event.id : event;
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
      const release = this.releases.get(eventId.serialize());
      if (release) {
        release.reject(error);
        this.releases.delete(eventId.serialize());
      } else {
        console.warn(`WithSuspense.fail: no release for ${event}`);
      }
      this.suspended.delete(eventId.serialize());
    }

    shouldFail = new Set<string>();
    markFailing(event: IEsEvent | EventId) {
      const eventId = "id" in event ? event.id : event;
      this.shouldFail.add(eventId.serialize());
      return () => {
        this.shouldFail.delete(eventId.serialize());
      };
    }

    _intercept(event: IEsEvent): Promise<void> {
      if (this.shouldFail.has(event.id.serialize())) {
        throw new Error(`WithSuspense._intercept: ${event} is marked to fail`);
      }

      return new Promise((resolve, reject) => {
        const suspender = this.suspended.get(event.id.serialize());

        if (suspender) {
          this.releases.set(event.id.serialize(), { resolve, reject });
          const fail = (error = new Error("manual failure")) => {
            Error.captureStackTrace(error, fail);
            this.fail(event, error);
          };

          suspender({
            resume: () => {
              this.resume(event);
            },
            fail,
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
        return `${event} ${when}`;
      });
    }

    async process(events: IEsEvent[], context: {}) {
      this._remember_before(events);
      await Promise.all(events.map((event) => this._intercept(event)));
      await super.process(events, context);
      this._remember_after(events);
      return events.map((event) => event.id);
    }
  }
  return WithSuspense;
});
