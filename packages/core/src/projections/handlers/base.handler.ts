import { Trait } from "@ddd-ts/traits";
import { IEsEvent } from "../../interfaces/es-event";
import { EventId } from "../../components/event-id";

export const BaseHandler = Trait((base) => {
  abstract class Handler extends base {
    declare description: {};
    declare context: {};

    abstract handle(
      events: IEsEvent[],
      context: this["context"],
    ): Promise<void>;

    abstract locks(event: IEsEvent): any;

    async process(events: IEsEvent[], context: {}): Promise<EventId[]> {
      await this.handle(events, context);
      return events.map((event) => event.id);
    }
  }
  return Handler;
});
