import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";

export const WithSequential = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithSequential extends base {
    declare description: Description<{
      name: "WithSequential";
      process: "for await (const event of events)";
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
      for await (const event of events) {
        await super.process([event], context);
      }
      return events.map((event) => event.id);
    }
  }
  return WithSequential;
});
