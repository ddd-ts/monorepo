import { EventId } from "../../components/event-id";
import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";

export const WithClaimTimeout = <const C extends number>(after: C) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithClaimTimeout extends base {
      declare description: Description<{
        name: "WithClaimTimeout";
        after_process: `queue: unclaims after ${C}ms of claiming`;
      }>;

      getClaimTimeout(event: this["event"]): number {
        return after;
      }
    }
    return WithClaimTimeout;
  });

export const WithIsolateAfter = <const C extends number>(after: C) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithIsolateAfter extends base {
      declare description: Description<{
        name: "WithIsolateAfter";
        before_process: `queue: isolates after ${C} failed attempts`;
      }>;

      getIsolateAfter(event: this["event"]): number {
        return after;
      }
    }
    return WithIsolateAfter;
  });

export const WithSkipAfter = <const C extends number>(after: C) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithSkipAfter extends base {
      declare description: Description<{
        name: "WithSkipAfter";
        before_process: `queue: skipped if ${C} failed attempts`;
      }>;

      getSkipAfter(event: this["event"]): number {
        return after;
      }
    }
    return WithSkipAfter;
  });
