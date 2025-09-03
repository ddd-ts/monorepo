import { AsyncLocalStorage } from "node:async_hooks";
import { BaseHandler } from "./base.handler";
import { Subtrait } from "@ddd-ts/traits";
import { Description } from "./description";

export class ProjectionContext {
  static storage = new AsyncLocalStorage<any>();

  static get<C>(): Partial<C> {
    return this.storage.getStore() || {};
  }

  static with<C, T extends () => any>(context: C, callback: T): ReturnType<T> {
    return this.storage.run(context, callback);
  }
}

export const WithContext = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithContext extends base {
    declare description: Description<{
      name: "WithContext";
      process: "with async context";
    }>;

    async process(events: this["event"][], context: this["context"]) {
      return ProjectionContext.with(context, () =>
        super.process(events, context),
      );
    }
  }

  return WithContext;
});
