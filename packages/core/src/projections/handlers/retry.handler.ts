import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { IEsEvent } from "../../interfaces/es-event";
import { Description } from "./description.handler";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const WithLocalRetry = <const C extends number, const D extends number>(
  count: C,
  delay: D,
) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithLocalRetry extends base {
      declare description: Description<{
        name: "WithLocalRetry";
        process: `try ${C} times with ${D}ms delay`;
      }>;
      declare context: { retryCount: number };

      async process(events: IEsEvent[], context: {}) {
        let attempts = 0;
        while (attempts < count) {
          try {
            await super.process(events, context);
            return events.map((event) => event.id);
          } catch (error) {
            attempts++;
            if (attempts >= count) {
              throw error;
            }
            await wait(delay);
          }
        }
        throw new Error(
          `WithLocalRetry.process failed after ${count} attempts`,
        );
      }
    }
    return WithLocalRetry;
  });

export const WithIsolateAfter = <const C extends number>(after: C) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithRetryInIsolation extends base {
      getIsolateAfter(event: IEsEvent): number {
        return after;
      }
    }
    return WithRetryInIsolation;
  });

export const WithSkipAfter = <const C extends number>(after: C) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithSkipAfter extends base {
      getSkipAfter(event: IEsEvent): number {
        return after;
      }
    }
    return WithSkipAfter;
  });
