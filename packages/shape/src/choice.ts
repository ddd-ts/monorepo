import { AbstractConstructor, Empty, Expand, Constructor } from "./_";

export type ChoiceMatcher<S extends string[]> =
  | {
      [key in S[number]]: () => any;
    }
  | ({
      _: () => any;
    } & {
      [key in S[number]]?: () => any;
    });

export type ChoiceMatcherResult<M extends ChoiceMatcher<any>> =
  M[keyof M] extends () => infer R ? R : never;

export const Choice = <
  const S extends string[],
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  config: S,
  base: B = Empty as any,
): IChoice<S, B> => {
  type Inline = S[number];

  abstract class $Choice extends (base as any as Constructor<{}>) {
    static $shape = "choice" as const;

    static $of = config;
    static values = config;

    constructor(public value: Expand<Inline>) {
      super();
    }

    is<T extends Inline>(
      value: T,
    ): this is Omit<this, "value" | "serialize"> & {
      value: T;
      serialize(): T;
    } {
      return this.value === value;
    }

    match<M extends ChoiceMatcher<S>>(matcher: M): ChoiceMatcherResult<M> {
      const handler = matcher[this.value];
      if (handler) return handler();
      return (matcher as { _: () => any })._();
    }

    serialize(): Inline {
      return this.value;
    }

    static deserialize<T extends typeof $Choice>(
      this: T,
      value: Inline,
    ): InstanceType<T> {
      return new (this as any)(value as any) as InstanceType<T>;
    }
    static $deserialize<T extends typeof $Choice>(
      this: T,
      value: Inline,
    ): Inline {
      return value;
    }
    static $serialize<T extends typeof $Choice>(
      this: T,
      value: Inline,
    ): Inline {
      return value;
    }

    static $inline: Inline;

    static {
      for (const choice of config) {
        (this as any)[choice] = function <T extends Constructor>(this: T) {
          return new this(choice as any);
        };
      }
    }
  }

  return $Choice as any;
};

export type IChoice<
  S extends string[],
  B extends AbstractConstructor<{}> = typeof Empty,
> = Omit<B, ""> & {
  $shape: "choice";
  $of: S;
  values: S;
  deserialize<T extends Constructor>(
    this: T,
    value: S[number],
  ): InstanceType<T>;
  $deserialize<T>(this: T, value: S[number]): S[number];
  $serialize<T>(this: T, value: S[number]): S[number];
  $inline: S[number];
} & (abstract new (
    value: S[number],
  ) => InstanceType<B> & {
    value: S[number];
    is<TH, T extends S[number]>(
      this: TH,
      value: T,
    ): this is Omit<TH, "serialize" | "value"> & {
      value: T;
      serialize(): T;
    };
    match<M extends ChoiceMatcher<S>>(matcher: M): ChoiceMatcherResult<M>;
    serialize(): S[number];
  }) & {
    [K in S[number]]: <T extends Constructor>(this: T) => InstanceType<T>;
  };
//# sourceMappingURL=choice.d.ts.map
