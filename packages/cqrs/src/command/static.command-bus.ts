import { CommandBusMiddleware, CommandHandler } from ".";
import { CommandBus } from "./command-bus";

// type MiddlewareResult<
//   M extends CommandBusMiddleware[],
//   R extends any
// > = M extends [infer U, ...infer Rest]
//   ? U extends CommandBusMiddleware
//     ? Rest extends CommandBusMiddleware[]
//       ? MiddlewareResult<Rest, ReturnType<U>>
//       : M extends []
//       ? R
//       : true
//     : false
//   : 2;

export class StaticCommandBus<
  Handlers extends CommandHandler[] = []
> extends CommandBus {
  register<H extends CommandHandler>(
    handler: H
  ): StaticCommandBus<[...Handlers, H]> {
    super.register(handler);
    return this as any;
  }

  use<M extends CommandBusMiddleware<Handlers[number]>>(middleware: M) {
    super.use(middleware);
    return this;
  }

  execute<T extends Parameters<Handlers[number]["execute"]>[0]>(command: T) {
    // type result = Handlers extends (infer H)[]
    //   ? H extends CommandHandler<{ type: T["type"] }>
    //     ? MiddlewareResult<Middlewares, ReturnType<H["execute"]>>
    //     : never
    //   : never;

    type result = Handlers extends (infer H)[]
      ? H extends CommandHandler<{ type: T["type"] }>
        ? ReturnType<H["execute"]>
        : never
      : never;

    return super.execute(command) as result;
  }
}
