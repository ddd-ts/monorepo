import {
  Constructor,
  Expand,
  DefinitionOf,
  AbstractConstructor,
  Empty,
  type Shorthand,
  Shape,
  type Definition,
} from "./_";
import { ClassShorthand } from "./class";
import { type DictShorthand } from "./dict";

type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;
type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
  ? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
  : [T, ...A];
type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

type CountUnion<T> = UnionToArray<T> extends infer U extends any[]
  ? U["length"]
  : never;

type UnshiftUnion<U> = UnionToArray<U> extends [infer F, ...any[]] ? F : never;

type UnionToOvlds<U> = UnionToIntersection<
  U extends any ? (f: U) => void : never
>;

type IsStringLiteral<T> = T extends string
  ? string extends T
    ? false
    : true
  : false;

type FindBestKeyForMatching<FromUnion> = UnshiftUnion<
  keyof FromUnion extends infer K
    ? K extends keyof FromUnion
      ? CountUnion<Pick<FromUnion, K>[K]> extends CountUnion<FromUnion>
        ? [IsStringLiteral<FromUnion[K]>] extends [true]
          ? K
          : never
        : never
      : never
    : never
>;

type MatcherConfig = { [key: string]: any };

type ExhaustiveMatcher<C> = C extends MatcherConfig
  ? {
      [key in keyof C]: (value: Expand<DefinitionOf<C[key]>["$inline"]>) => any;
    }
  : never;

type UnsafeFallthroughMatcher<C> = C extends MatcherConfig
  ? {
      [key in keyof C]?: (
        value: Expand<DefinitionOf<C[key]>["$inline"]>,
      ) => any;
    } & {
      _: (value: Expand<DefinitionOf<C[keyof C]>["$inline"]>) => any;
    }
  : never;

type PartialMatcher<C> = C extends MatcherConfig
  ? {
      [key in keyof C]?: (
        value: Expand<DefinitionOf<C[key]>["$inline"]>,
      ) => any;
    }
  : never;

type Matcher<C> = C extends MatcherConfig
  ? ExhaustiveMatcher<C> | UnsafeFallthroughMatcher<C> | PartialMatcher<C>
  : never;

type Config = DictShorthandInput | ClassInput | ClassDictInput | DictInput;

type ClassInput = ClassShorthand;

type ClassDictInput = ClassShorthand & { $of: {} };

type DictInput = { $of: {} };

type DictShorthandInput = DictShorthand;

type Access<T, K> = K extends keyof T ? T[K] : never;

type Entries<T extends readonly any[], K> = UnionToIntersection<
  {
    [i in keyof T]: Access<GetShape<T[i]>, K> extends infer U extends string
      ? IsStringLiteral<U> extends true
        ? {
            [key in U]: T[i] extends DictShorthandInput
              ? DefinitionOf<T[i]>
              : T[i];
          }
        : never
      : never;
  }[number]
>;

type GetShape<S extends Config> = S extends DictInput
  ? S["$of"]
  : S extends ClassInput
    ? Access<S, "prototype">
    : S;

export type BestKey<S extends readonly Config[]> = {
  [key in keyof S]: GetShape<S[key]>;
}[number] extends infer U
  ? FindBestKeyForMatching<U>
  : never;

export type DiscriminatedUnionConfiguration = readonly Config[];

export function findBestKey(config: DiscriminatedUnionConfiguration) {
  const hash: Record<string, Set<string>> = {};

  for (const c of config) {
    const shape = "$of" in c ? c.$of : c;
    for (const key in shape) {
      const k = key as keyof typeof shape;
      if (hash[key]) {
        hash[key].add(shape[k]);
      } else {
        hash[key] = new Set([shape[k]]);
      }
    }
  }

  const key = Object.entries(hash)
    .map(([key, value]) => [key, value.size] as const)
    .filter(([_, value]) => value === config.length)
    .sort((a, b) => b[1] - a[1])?.[0]?.[0];

  if (!key) {
    throw new Error("Could not find key for DiscriminatedUnion");
  }

  return key;
}

export function prepareShapeMap(
  config: DiscriminatedUnionConfiguration,
  key: string,
) {
  return config.reduce<{ [key: string]: Definition }>((acc, c) => {
    const shape = Shape(c);

    // Here, we are handling the two cases of the configuration:
    // - the first one is when the configuration is a Definition directly.
    //   we can access the discriminator directly from the shape $of property
    // - the second one is when the configuration is a DictShorthand or a plain Class.
    //   we first have to turn it into a Definition before accessing the discriminator
    //   Dict $of property references the configuration provided, which allows us to capture the discriminator
    //   Class $of property references the constructor of the class, which allows us to capture the discriminator
    //   which is mandatorily defined on the static side of the class
    const discriminator =
      key in c
        ? (c as any)[key]
        : "$of" in c
          ? (c as any).$of[key]
          : (shape as any).$of[key];

    acc[discriminator] = shape;
    return acc;
  }, {});
}

type Internal<
  S extends DiscriminatedUnionConfiguration,
  K extends BestKey<S>,
> = {
  Map: Entries<S, K>;
  Serialized: ReturnType<DefinitionOf<S[number]>["$serialize"]>;
  Inline: DefinitionOf<S[number]>["$inline"];
};

export const DiscriminatedUnion = <
  S extends DiscriminatedUnionConfiguration,
  K extends BestKey<S>,
  const B extends AbstractConstructor<{}> = typeof Empty,
  IInternal extends Internal<S, K> = Internal<S, K>,
>(
  of: S,
  ...args: [base?: B]
) => {
  const base = args[0] || (Empty as any);

  const key = findBestKey(of);
  const map = prepareShapeMap(of, key);

  abstract class $DiscriminatedUnion extends (base as any as Constructor<{}>) {
    constructor(public value: IInternal["Inline"]) {
      super();
    }

    static serialized: IInternal["Serialized"];

    static $of = of;

    static $shape = "discriminated-union" as const;

    serialize(): Expand<IInternal["Serialized"]> {
      return ($DiscriminatedUnion as any).$serialize(this.value) as any;
    }

    match<
      M extends Matcher<IInternal["Map"]>,
      F extends M extends ExhaustiveMatcher<IInternal["Map"]>
        ? []
        : M extends UnsafeFallthroughMatcher<IInternal["Map"]>
          ? []
          : M extends PartialMatcher<IInternal["Map"]>
            ? [
                fallback: (
                  value: Omit<IInternal["Map"], keyof M>[keyof Omit<
                    IInternal["Map"],
                    keyof M
                  >] extends infer U extends Shorthand
                    ? Expand<DefinitionOf<U>["$inline"]>
                    : never,
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
      const element: any = this.value;
      const discriminant = element[key];

      const handler = matcher[discriminant];
      if (handler) {
        return handler(element);
      }
      if (fallback) {
        return fallback(element);
      }
      if (matcher._) {
        return matcher._(element);
      }
      throw new Error("Non-exhaustive match");
    }

    static deserialize<T extends typeof $DiscriminatedUnion>(
      this: T,
      value: Expand<IInternal["Serialized"]>,
    ): InstanceType<T> {
      return new (this as any)(this.$deserialize(value as any)) as any;
    }

    static $deserialize<T extends typeof $DiscriminatedUnion>(
      this: T,
      value: IInternal["Serialized"],
    ): IInternal["Inline"] {
      const definition = map[value[key]];
      if (!definition) {
        throw new Error("Cannot deserialize DiscriminatedUnion");
      }
      return (definition as any).$deserialize(value);
    }

    static $serialize<T extends typeof $DiscriminatedUnion>(
      this: T,
      value: IInternal["Inline"],
    ): IInternal["Serialized"] {
      return map[(value as any)[key]].$serialize(value);
    }

    static $inline: IInternal["Inline"];
  }

  type DiscriminatedUnionConstructor = abstract new (
    value: Expand<IInternal["Inline"]>,
  ) => InstanceType<B> & $DiscriminatedUnion;
  type DiscriminatedUnion = Omit<B, "prototype"> &
    Omit<typeof $DiscriminatedUnion, "prototype"> &
    DiscriminatedUnionConstructor;

  return $DiscriminatedUnion as DiscriminatedUnion;
};
