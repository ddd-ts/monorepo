import { Query, QueryBusMiddleware, QueryHandler } from ".";

export class QueryBus {
  handlers = new Map<string, QueryHandler>();
  middlewares = new Set<QueryBusMiddleware>();

  register(handler: QueryHandler) {
    for (const messageType of handler.on) {
      if (this.handlers.has(messageType)) {
        throw new Error(
          `Handler already registered for query type: ${messageType}`
        );
      }
      this.handlers.set(messageType, handler);
    }
  }

  use(middleware: QueryBusMiddleware) {
    this.middlewares.add(middleware);
  }

  execute<H extends QueryHandler>(query: Query): ReturnType<H["execute"]> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`No handler found for query ${query.type}`);
    }

    const middlewares = [...this.middlewares.values()];

    const chain = middlewares.reduce(
      (next: () => any, middleware) => () => middleware(query, handler, next),
      () => handler.execute(query)
    );

    return chain();
  }
}
