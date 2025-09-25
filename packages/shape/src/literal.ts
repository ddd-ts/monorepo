import { AbstractConstructor, Constructor, Empty, Expand } from "./_";

export type LiteralShorthand = string | number;

export const Literal = <
  const S extends LiteralShorthand,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
): ILiteral<S, B> => {
  type Inline = S;

  abstract class $Literal extends (base as any as Constructor<{}>) {
    public readonly value = of;
    static value = of;
    static $shape = "literal" as const;
    serialize(): S {
      return of;
    }

    static deserialize<T extends typeof $Literal>(
      this: T,
      value: Inline,
    ): InstanceType<T> {
      return new (this as any)() as InstanceType<T>;
    }

    static $serialize(value: Inline): Inline {
      return of;
    }

    static $deserialize(value: Inline): Inline {
      return of;
    }

    static $inline: Inline;
  }

  return $Literal as any;
};

export type ILiteral<
  S extends LiteralShorthand,
  B extends AbstractConstructor<{}> = typeof Empty,
> = Omit<B, "prototype"> & {
  value: S;
  $shape: "literal";
  deserialize<T extends Constructor>(this: T, value: S): InstanceType<T>;
  $serialize(value: S): S;
  $deserialize(value: S): S;
  $inline: S;
} & (abstract new (
    value: Expand<S>,
  ) => InstanceType<B> & {
    readonly value: S;
    serialize(): S;
  });
