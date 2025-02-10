import {
  Constructor,
  Expand,
  DefinitionOf,
  Shape,
  AbstractConstructor,
  Empty,
} from "./_";
import { ClassShorthand } from "./class";
import { PrimitiveShorthand } from "./primitive";

type Config = { [key: string]: any };

type ExhaustiveMatcher<C extends Config> = {
  [key in keyof C]: (value: InstanceType<C[key]>) => any;
};

type UnsafeFallthroughMatcher<C extends Config> = {
  [key in keyof C]?: (value: InstanceType<C[key]>) => any;
} & {
  _: (value: InstanceType<C[keyof C]>) => any;
};

type PartialMatcher<C extends Config> = {
  [key in keyof C]?: (value: InstanceType<C[key]>) => any;
};

type Matcher<C extends Config> =
  | ExhaustiveMatcher<C>
  | UnsafeFallthroughMatcher<C>
  | PartialMatcher<C>;

export type EitherConfiguration = {
  [key: string]: ClassShorthand;
};

export const Either = <
  const S extends EitherConfiguration,
  const B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
) => {
  type Serialized = {
    [K in keyof S]: { _key: K } & ReturnType<DefinitionOf<S[K]>["$serialize"]>;
  }[keyof S];

  type Inline = DefinitionOf<S[keyof S]>["$inline"];

  const definitions = Object.fromEntries(
    Object.entries(of).map(([key, value]) => {
      return [key, Shape(value)] as const;
    }),
  );

  abstract class $Either extends (base as any as Constructor<{}>) {
    constructor(public value: Inline) {
      super();
    }

    static serialized: Serialized;

    static of = of;

    static $shape = "either" as const;

    serialize(): Expand<Serialized> {
      return ($Either as any).$serialize(this.value) as any;
    }

    match<
      M extends Matcher<S>,
      F extends M extends ExhaustiveMatcher<S>
      ? []
      : M extends UnsafeFallthroughMatcher<S>
      ? []
      : M extends PartialMatcher<S>
      ? [
        fallback: (
          value: InstanceType<Omit<S, keyof M>[keyof Omit<S, keyof M>]>,
        ) => any,
      ]
      : [],
    >(
      ...[matcher, fallback]: [matcher: M, ...F]
    ):
      | (M[keyof M] extends (...args: any[]) => any
        ? ReturnType<M[keyof M]>
        : never)
      | (F[0] extends (...args: any[]) => any ? ReturnType<F[0]> : never) {
      const key: any = Object.entries(of).find(
        ([_, v]) => v === ((this.value as any).constructor as any),
      )?.[0] as any;

      const handler = matcher[key];
      if (handler) {
        return handler(this.value as any);
      }
      if (fallback) {
        return fallback(this.value as any);
      }
      if (matcher._) {
        return matcher._(this.value as any);
      }
      throw new Error("Non-exhaustive match");
    }

    static deserialize<T extends typeof $Either>(
      this: T,
      value: Expand<Serialized>,
    ): InstanceType<T> {
      return new (this as any)(this.$deserialize(value as any)) as any;
    }

    static $deserialize<T extends typeof $Either>(
      this: T,
      value: Serialized,
    ): Inline {
      const { _key: key, ...serialized } = value as any;
      const definition = definitions[key];
      if (!definition) {
        throw new Error("Cannot deserialize Either");
      }
      return (definition as any).$deserialize(serialized);
    }

    static $serialize<T extends typeof $Either>(
      this: T,
      value: Inline,
    ): Serialized {
      const key = Object.entries(of).find(
        ([_, v]) => v === ((value as any).constructor as any),
      )?.[0];
      if (!key) {
        throw new Error("Cannot serialize Either, no matching key");
      }

      const definition = definitions[key];
      if (!definition) {
        throw new Error("Cannot serialize Either");
      }
      return { ...(definition as any).$serialize(value), _key: key } as any;
    }

    static $inline: Inline;
  }

  type EitherConstructor = abstract new (
    value: Expand<Inline>,
  ) => InstanceType<B> & $Either;
  type Either = Omit<B, "prototype"> &
    Omit<typeof $Either, "prototype"> &
    EitherConstructor;

  return $Either as Either;
};
