import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { type Description } from "./description";
import type { IEvent } from "../../interfaces/event";

export const WithCancellable = Subtrait([{} as typeof BaseHandler], (base, Props) => {
  abstract class WithCancellable extends base {
    declare description: Description<{
      name: "withCancellable";
      before_process: "check if cancelled before and throw if so";
      after_process: "check if cancelled after and throw if so";
    }>;

    declare context: {
      assertBeforeInsert: (events: IEvent[]) => Promise<void>;
    };

    async process(events: this["event"][], context: {
      assertBeforeInsert: (events: IEvent[]) => Promise<void>;
    }) {
      await super.process(events, context);
      await context.assertBeforeInsert(events);
      return events.map((event) => event.id);
    }
  }
  return WithCancellable;
});
