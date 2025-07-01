import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description.handler";
import { IEsEvent } from "../../interfaces/es-event";

export const WithParallel = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithParallel extends base {
    declare description: Description<{
      name: "WithParallel";
      process: "await parallel for (const event of events)";
      handle: "call handleOne for the event";
    }>;

    abstract handleOne(
      event: IEsEvent,
      context: this["context"],
    ): Promise<void>;

    async handle(events: IEsEvent[], context: this["context"]) {
      await Promise.all(events.map((event) => this.handleOne(event, context)));
    }

    async process(events: IEsEvent[], context: any) {
      await Promise.all(events.map((event) => super.process([event], context)));
      return events.map((event) => event.id);
    }
  }
  return WithParallel;
});
