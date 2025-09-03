import { Subtrait, Trait } from "@ddd-ts/traits";
import { IEsEvent } from "../../interfaces/es-event";
import { EventId } from "../../components/event-id";
import { DerivedDescription } from "./description";

export const WithProps = <A extends {}>() =>
  Subtrait([{} as Trait], (base, Props) => {
    abstract class WithProps extends base {
      constructor(public props: A & typeof Props) {
        super(props);
      }
    }
    return WithProps;
  });

export const BaseHandler = Trait((base) => {
  abstract class Handler<E extends IEsEvent> extends base {
    // biome-ignore lint/complexity/noUselessConstructor: <explanation>
    constructor(props: {}) {
      super(props);
    }

    declare description: {};
    declare context: {};
    declare event: E;

    abstract handle(
      events: this["event"][],
      context: this["context"],
    ): Promise<void>;

    abstract locks(event: this["event"]): any;

    async process(events: this["event"][], context: {}): Promise<EventId[]> {
      await this.handle(events, context);
      return events.map((event) => event.id);
    }

    static debug<T>(this: T, debug: DerivedDescription<T>): never {
      throw new Error("Debugging not implemented for this handler");
    }
  }
  return Handler;
});
