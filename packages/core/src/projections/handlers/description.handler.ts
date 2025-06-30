import { Expand } from "@ddd-ts/shape";
import { Subtrait, Trait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";

type GetDescription<D extends Description<any>> = D[keyof D];

type MapToDescription<
  ProcessTraits extends Trait[],
  HandleTraits extends Trait[] = ProcessTraits,
> = ProcessTraits extends [...infer R extends Trait[], infer H extends Trait]
  ? H extends Trait
    ? InstanceType<ReturnType<H["factory"]>> extends infer Impl
      ? Impl extends { description: infer D extends Description<any> }
        ? GetDescription<D> extends {
            name: infer Name;
            before_process?: infer Before;
            process?: infer Process;
            after_process?: infer After;
          }
          ? (Before extends string
              ? {
                  [K in Before]: Name;
                }
              : {}) &
              (Process extends string
                ? {
                    [K in Process]: MapToDescription<R, HandleTraits>;
                  }
                : MapToDescription<R, HandleTraits>) &
              (After extends string
                ? {
                    [K in After]: Name;
                  }
                : {})
          : never
        : MapToDescription<R, HandleTraits>
      : never
    : never
  : HandleTraits extends [...infer R extends Trait[], infer H extends Trait]
    ? H extends Trait
      ? InstanceType<ReturnType<H["factory"]>> extends infer Impl
        ? Impl extends { description: infer D extends Description<any> }
          ? GetDescription<D> extends {
              name: infer Name;
              before_handle?: infer BeforeHandle;
              handle?: infer Handle;
              after_handle?: infer AfterHandle;
            }
            ? (BeforeHandle extends string
                ? {
                    [K in BeforeHandle]: Name;
                  }
                : {}) &
                (Handle extends string
                  ? {
                      [K in Handle]: MapToDescription<ProcessTraits, R>;
                    }
                  : MapToDescription<ProcessTraits, R>) &
                (AfterHandle extends string
                  ? {
                      [K in AfterHandle]: Name;
                    }
                  : {})
            : never
          : MapToDescription<R, HandleTraits>
        : never
      : never
    : "EXECUTE";

/**
 * Turns a Printable object into a multiline string.
 * Each key is printed on a new line, with its value indented.
 * If the value is a string, it is printed as is.
 * If the value is another Printable object, it is printed recursively, maintaining the indentation.
 */

export type DerivedDescription<Derived> = Derived extends {
  __traits__: infer Traits extends Trait[];
}
  ? Expand<MapToDescription<Traits>>
  : never;

export type IDescription = {
  name: string;
  before_process?: string;
  process?: string;
  after_process?: string;
  before_handle?: string;
  handle?: string;
  after_handle?: string;
};

export type Description<T extends IDescription> = { [K in T["name"]]: T };

export const WithDebug = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithDebug extends base {
    static debug<T>(this: T, debug: DerivedDescription<T>): never {
      throw new Error("Debugging not implemented for this handler");
    }
  }
  return WithDebug;
});
