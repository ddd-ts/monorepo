import { Event, EventBusMiddleware, EventHandler } from ".";

export class EventBus {
  handlers = new Map<string, EventHandler[]>();
  middlewares = new Set<EventBusMiddleware>();

  register(handler: EventHandler) {
    for (const messageType of handler.on) {
      const handlers = this.handlers.get(messageType) || [];
      handlers.push(handler);
      this.handlers.set(messageType, handlers);
    }
  }

  use(middleware: EventBusMiddleware) {
    this.middlewares.add(middleware);
  }

  publish(event: Event) {
    const handlers = this.handlers.get(event.type) || [];

    const middlewares = [...this.middlewares.values()];
    const chain = (event: Event, handler: EventHandler) =>
      middlewares.reduce(
        (acc: () => any, middleware) => middleware(event, handler, acc),
        () => handler.handle(event)
      );

    return Promise.all(handlers.map((handler) => chain(event, handler)()));
  }
}
