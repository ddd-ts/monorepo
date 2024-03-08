import { AbstractConstructor, Concrete, Constructor, Empty, Expand } from "./_";

type LiteralMap = [
  [StringConstructor, string],
  [NumberConstructor, number],
  [DateConstructor, Date],
  [BooleanConstructor, boolean],
];

type LiteralConstructor = LiteralMap[number][0];
export type LiteralFromConstructor<S> = Extract<
  LiteralMap[number],
  [S, any]
>[1];

export type LiteralShorthand = LiteralConstructor;

export const Literal = <
  S extends LiteralConstructor,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
) => {
  type Inline = LiteralFromConstructor<S>;

  abstract class $Literal extends (base as any as Constructor<{}>) {
    constructor(public readonly value: Expand<Inline>) {
      super();
    }

    static $name = "literal" as const;

    serialize(): Inline {
      return this.value;
    }

    static deserialize<T extends Concrete<typeof $Literal>>(
      this: T,
      value: Inline,
    ): InstanceType<T> {
      return new this(this.$deserialize(value)) as InstanceType<T>;
    }

    static $serialize(value: Inline): Inline {
      return value;
    }

    static $deserialize(value: Inline): Inline {
      return value;
    }

    static $inline: Expand<Inline>;
  }

  type LiteralConstructor = abstract new (
    value: Expand<Inline>,
  ) => InstanceType<B> & $Literal;

  type Literal = Omit<B, "prototype"> &
    Omit<typeof $Literal, "prototype"> &
    LiteralConstructor;

  return $Literal as Literal;
};
