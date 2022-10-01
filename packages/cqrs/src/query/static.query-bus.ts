import { QueryBusMiddleware, QueryHandler } from ".";
import { QueryBus } from "./query-bus";

// type MiddlewareResult<
//   M extends QueryBusMiddleware[],
//   R extends any
// > = M extends [infer U, ...infer Rest]
//   ? U extends QueryBusMiddleware
//     ? Rest extends QueryBusMiddleware[]
//       ? MiddlewareResult<Rest, ReturnType<U>>
//       : M extends []
//       ? R
//       : true
//     : false
//   : 2;

export class StaticQueryBus<
  Handlers extends QueryHandler[] = []
> extends QueryBus {
  register<H extends QueryHandler>(
    handler: H
  ): StaticQueryBus<[...Handlers, H]> {
    super.register(handler);
    return this as any;
  }

  use<M extends QueryBusMiddleware<Handlers[number]>>(middleware: M) {
    super.use(middleware);
    return this;
  }

  execute<T extends Parameters<Handlers[number]["execute"]>[0]>(query: T) {
    type result = Handlers extends (infer H)[]
      ? H extends QueryHandler<{ type: T["type"] }>
        ? ReturnType<H["execute"]>
        : never
      : never;

    return super.execute(query) as result;
  }
}
