import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";

export const WithCancellable = Subtrait([{} as typeof BaseHandler], (base, Props) => {
  abstract class WithCancellable extends base {
    declare description: Description<{
      name: "withCancellable";
      before_process: "check if cancelled before and throw if so";
      after_process: "check if cancelled after and throw if so";
    }>;

    declare context: {
      assertBeforeInsert: (events: this["event"][]) => Promise<void>;
    };

    async process(events: this["event"][], context: {
      assertBeforeInsert: (events: this["event"][]) => Promise<void>;
    }) {
      // debugger;
      await super.process(events, context);
      // debugger;
      await context.assertBeforeInsert(events);
      return events.map((event) => event.id);
    }
  }
  return WithCancellable;
});
