import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import type { Description } from "./description";

export const WithDelay = <const D extends number>(delayMs: D) =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithDelay extends base {
      declare description: Description<{
        name: "WithDelay";
        process: `sleep ${D}ms before handling`;
      }>;

      delayMs = delayMs;

      async process(events: this["event"][], context: {}) {
        if (this.delayMs > 0)
          await new Promise((r) => setTimeout(r, this.delayMs));
        return super.process(events, context);
      }
    }
    return WithDelay;
  });
