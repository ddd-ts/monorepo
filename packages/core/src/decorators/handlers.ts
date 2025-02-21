import type { Constructor } from "@ddd-ts/types";
import type { IEvent } from "../interfaces/event";
import type { INamed } from "../interfaces/named";

export function getHandler(target: any, name: any): Function | undefined {
  const handlers =
    target[Symbol.metadata]?.handlers ||
    target.constructor[Symbol.metadata]?.handlers;

  return handlers?.get(name);
}

// The following implementation is for new TS 5 decorators API
// export function On(EVENT: Constructor<IEvent> & INamed) {
//   return (handler: Function, context: ClassMethodDecoratorContext) => {
//     console.log(handler, context);
//     const metadata = context.metadata as { handlers?: Map<string, Function> };
//     const handlers = metadata.handlers || new Map();
//     handlers.set(EVENT.name, handler);
//     metadata.handlers = handlers;
//   };
// }

export function On(EVENT: Constructor<IEvent> & INamed) {
  return (target: any, key: string, descriptor: PropertyDescriptor) => {
    const metadata = target[Symbol.metadata] || {};
    const handlers = metadata.handlers || new Map();
    handlers.set(EVENT.name, descriptor.value);
    metadata.handlers = handlers;
    target[Symbol.metadata] = metadata;
  };
}
