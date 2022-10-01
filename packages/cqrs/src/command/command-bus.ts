import { Command, CommandBusMiddleware, CommandHandler } from ".";

export class CommandBus {
  handlers = new Map<string, CommandHandler>();
  middlewares = new Set<CommandBusMiddleware>();

  register(handler: CommandHandler) {
    for (const messageType of handler.on) {
      if (this.handlers.has(messageType)) {
        throw new Error(
          `Handler already registered for command type: ${messageType}`
        );
      }
      this.handlers.set(messageType, handler);
    }
  }

  use(middleware: CommandBusMiddleware) {
    this.middlewares.add(middleware);
  }

  execute<H extends CommandHandler>(
    command: Command
  ): ReturnType<H["execute"]> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`No handler found for command ${command.type}`);
    }

    const middlewares = [...this.middlewares.values()];

    const chain = middlewares.reduce(
      (next: () => any, middleware) => () => middleware(command, handler, next),
      () => handler.execute(command)
    );

    return chain();
  }
}
