import { EventId } from "../../components/event-id";
import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";

export const WithLocalTimeout = <const D extends number>(timeout: D) =>
  Subtrait([{} as ReturnType<typeof BaseHandler>], (base) => {
    abstract class WithLocalTimeout extends base {
      declare description: Description<{
        name: "WithLocalTimeout";
        process: `timeout after ${D}ms of processing`;
      }>;

      timeout = timeout;

      async process(events: this["event"][], context: {}) {
        const timeoutPromise = new Promise<EventId[]>((_, reject) =>
          setTimeout(() => {
            reject(
              new Error(
                `WithLocalTimeout.process timed out after ${timeout}ms`,
              ),
            );
          }, timeout),
        );

        const processPromise = super.process(events, context);

        const result = await Promise.race([processPromise, timeoutPromise]);
        return result;
      }
    }
    return WithLocalTimeout;
  });
