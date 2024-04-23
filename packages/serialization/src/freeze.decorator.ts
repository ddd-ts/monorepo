import type { Differences } from "./differences";

type Freezable<T> = {
  serialize(...args: any[]): T;
};

type Ctor<T> = abstract new (...args: any[]) => T;

export function Freeze<L = any>() {
  return <
    C extends Ctor<Freezable<any>>,
    R extends Awaited<ReturnType<InstanceType<C>["serialize"]>>,
  >(
    target: C,
  ): R extends L
    ? C
    : Differences<L, R, { left: "Frozen"; right: "Serializer" }> => {
    return target as any;
  };
}
