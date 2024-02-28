import { Definition } from "./definition";

type Matcher<cases extends string> = {
  [K in cases]?: () => any;
};

type Catchall = { _: () => any };

type MatcherParam<cases extends string> =
  | Required<Matcher<cases>>
  | (Matcher<cases> & Catchall);

class Matchable<C extends string> {
  constructor(public readonly value: C) { }

  is<U extends C>(value: U): this is this & { value: U; serialize(): U } {
    return this.value === value;
  }

  match<M extends MatcherParam<C>>(
    matcher: M
  ): M extends Required<MatcherParam<C>>
    ? {
      [K in C]: M[K] extends () => infer R ? R : never;
    }[C]
    :
    | {
      [K in C]: M[K] extends () => infer R ? R : never;
    }[C]
    | (M extends { _: () => infer R } ? R : never) {
    const fn = matcher[this.value] ?? (matcher as any)._;
    return fn() as any;
  }
}

export type StringEnumConfiguration = string[];
export type StringEnumShorthand = StringEnumConfiguration;
export type StringEnumDefinition<C extends StringEnumConfiguration = StringEnumConfiguration> =
  Definition<Matchable<C[number]>, C[number], C[number]>;
export function StringEnum<const C extends StringEnumConfiguration>(
  ...configuration: C
): StringEnumDefinition<C> {
  return {
    paramToRuntime: (param) => new Matchable(param),
    serialize: (runtime) => {
      return runtime.value;
    },
    deserialize: (serialized) => {
      return serialized;
    }
  };
}
