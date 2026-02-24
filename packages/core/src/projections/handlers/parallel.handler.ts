import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import type { Description } from "./description";

export const WithParallel = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithParallel extends base {
    declare description: Description<{
      name: "WithParallel";
      process: "await parallel for (const event of events)";
      handle: "call handleOne for the event";
    }>;

    abstract handleOne(
      event: this["event"],
      context: this["context"],
    ): Promise<void>;

    async handle(events: this["event"][], context: this["context"]) {
      await Promise.all(events.map((event) => this.handleOne(event, context)));
    }

    async process(events: this["event"][], context: any) {
      await Promise.all(events.map((event) => super.process([event], context)));
      return events.map((event) => event.id);
    }
  }
  return WithParallel;
});
