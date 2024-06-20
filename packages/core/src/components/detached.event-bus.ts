import type { Constructor } from "@ddd-ts/types";
import type { IEvent } from "../interfaces/event";
import type { IEventBus } from "../interfaces/event-bus";

type EventHandlerFn<E extends IEvent> = (event: E) => Promise<void>;

export class DetachedEventBus implements IEventBus {
  handlers = new Map<string, EventHandlerFn<IEvent>[]>();

  on<E extends IEvent>(
    event: Constructor<E>,
    handler: EventHandlerFn<E>,
  ): void {
    const handlers = this.handlers.get(event.name) || [];
    handlers.push(handler as EventHandlerFn<IEvent>);
    this.handlers.set(event.name, handlers);
  }

  off<E extends IEvent>(
    event: Constructor<E>,
    handler: EventHandlerFn<E>,
  ): void {
    const handlers = this.handlers.get(event.name) || [];
    this.handlers.set(
      event.name,
      handlers.filter((h) => h !== handler),
    );
  }

  async publish(event: IEvent): Promise<void> {
    const handlers = this.handlers.get(event.name) || [];
    for (const handler of handlers) {
      void handler(event);
    }
  }
}
