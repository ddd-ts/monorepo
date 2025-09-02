import { Trait } from "@ddd-ts/traits";
import { IEsEvent } from "../../interfaces/es-event";
import { EventId } from "../../components/event-id";
import { DerivedDescription } from "./description";

export const BaseHandler = <
  T extends IEsEvent = IEsEvent,
  P extends {} = {},
>() =>
  Trait((base) => {
    abstract class Handler extends base {
      declare $props: P;
      constructor(public props: P) {
        super(props);
      }

      declare description: {};
      declare context: {};
      declare event: T;

      abstract handle(events: T[], context: this["context"]): Promise<void>;

      abstract locks(event: T): any;

      async process(events: T[], context: {}): Promise<EventId[]> {
        await this.handle(events, context);
        return events.map((event) => event.id);
      }

      static debug<T>(this: T, debug: DerivedDescription<T>): never {
        throw new Error("Debugging not implemented for this handler");
      }
    }
    return Handler;
  });
