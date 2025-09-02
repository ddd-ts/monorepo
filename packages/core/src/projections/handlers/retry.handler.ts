import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function* attempts(delay: number, attempts: number) {
  let remaining = attempts;
  while (remaining-- > 0) {
    yield true;
    await wait(delay);
  }
  yield false;
}

export const WithLocalRetry = <const C extends number, const D extends number>(
  count: C,
  delay: D,
) =>
  Subtrait([{} as ReturnType<typeof BaseHandler>], (base) => {
    abstract class WithLocalRetry extends base {
      declare description: Description<{
        name: "WithLocalRetry";
        process: `try ${C} times with ${D}ms delay`;
      }>;
      declare context: { retryCount: number };

      async process(events: this["event"][], context: {}) {
        for await (const retry of attempts(delay, count)) {
          try {
            await super.process(events, context);
            return events.map((event) => event.id);
          } catch (error) {
            if (!retry) throw error;
          }
        }
        throw new Error("Unreachable");
      }
    }
    return WithLocalRetry;
  });
