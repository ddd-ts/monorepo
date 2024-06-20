import { Divergence, Expand, IsNever } from "./divergence";

type Freezable<T> = {
  serialize(...args: any[]): T;
};

type Ctor<T> = abstract new (...args: any[]) => T;

export function Freeze<Frozen = any>() {
  return <
    C extends Ctor<Freezable<any>>,
    Serialized extends Awaited<ReturnType<InstanceType<C>["serialize"]>>,
  >(
    target: C,
  ): Divergence<Serialized, Frozen> extends infer D
    ? IsNever<D> extends true
      ? C
      : Expand<D>
    : never => {
    return target as any;
  };
}
