import { type AbstractConstructor, type Concrete, type Constructor, Empty, type Expand } from "./_";

type PrimitiveMap = [
  [StringConstructor, string],
  [NumberConstructor, number],
  [DateConstructor, Date],
  [BooleanConstructor, boolean],
];

type PrimitiveConstructor = PrimitiveMap[number][0];
export type PrimitiveFromConstructor<S> = Extract<
  PrimitiveMap[number],
  [S, any]
>[1];

export type PrimitiveShorthand = PrimitiveConstructor;

export type IPrimitive<
  S extends PrimitiveConstructor,
  B extends AbstractConstructor<{}> = typeof Empty,
> = Omit<B, ""> &
  (abstract new (
    value: Expand<PrimitiveFromConstructor<S>>,
  ) => InstanceType<B> & {
    readonly value: Expand<PrimitiveFromConstructor<S>>;
    serialize(): PrimitiveFromConstructor<S>;
  }) & {
    $shape: "primitive";
    deserialize<T extends Constructor<any>>(
      this: T,
      value: PrimitiveFromConstructor<S>,
    ): InstanceType<T>;
    $serialize(value: PrimitiveFromConstructor<S>): PrimitiveFromConstructor<S>;
    $deserialize(
      value: PrimitiveFromConstructor<S>,
    ): PrimitiveFromConstructor<S>;
    $inline: Expand<PrimitiveFromConstructor<S>>;
  };

export const Primitive = <
  S extends PrimitiveConstructor,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
): IPrimitive<S, B> => {
  type Inline = PrimitiveFromConstructor<S>;

  abstract class $Primitive extends (base as any as Constructor<{}>) {
    constructor(public readonly value: Expand<Inline>) {
      super();
    }

    static $shape = "primitive" as const;

    serialize(): Inline {
      return this.value;
    }

    static deserialize<T extends typeof $Primitive>(
      this: T,
      value: Inline,
    ): InstanceType<T> {
      return new (this as any)(this.$deserialize(value)) as InstanceType<T>;
    }

    static $serialize(value: Inline): Inline {
      return value;
    }

    static $deserialize(value: Inline): Inline {
      if (of === Date && typeof value === "string") {
        return new Date(value);
      }
      return value;
    }

    static $inline: Expand<Inline>;
  }

  type PrimitiveConstructor = abstract new (
    value: Expand<Inline>,
  ) => InstanceType<B> & $Primitive;

  type Primitive = Omit<B, "prototype"> &
    Omit<typeof $Primitive, "prototype"> &
    PrimitiveConstructor;

  return $Primitive as any;
};
