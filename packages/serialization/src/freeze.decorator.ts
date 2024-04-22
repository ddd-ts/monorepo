import type { Differences, Equals } from "./differences";

type Freezable<T> = {
  serialize(...args: any[]): T;
};

type Ctor<T> = abstract new (...args: any[]) => T;

export function Freeze<T = any>() {
  return <
    C extends Ctor<Freezable<any>>,
    R extends Awaited<ReturnType<InstanceType<C>["serialize"]>>,
  >(
    target: C,
  ): Equals<R, T> extends true
    ? C
    : Differences<T, R, { left: "Frozen"; right: "Serializer" }> => {
    return target as any;
  };
}
