import {
  Concrete,
  Definition,
  Expand,
  MakeAbstract,
  Shorthand,
  DefinitionOf,
  forward,
  Shape,
  AbstractConstructor,
  Empty,
  Constructor,
} from "./_";

export type MultipleShorthand = (Definition | Shorthand)[];

export type MultipleConfiguration = Definition | Shorthand;

export const Multiple = <
  const S extends MultipleConfiguration,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
) => {
  type Def = DefinitionOf<S>;
  type Serialized = ReturnType<Def["$serialize"]>[];
  type Inline = Def["$inline"][];

  const longhand = Shape(of);

  abstract class $Multiple extends (base as any as Constructor<{}>) {
    constructor(public value: Inline) {
      super();
    }
    static $name = "multiple" as const;

    serialize(): Expand<Serialized> {
      return $Multiple.$serialize(this.value) as any;
    }

    static deserialize<T extends typeof $Multiple>(
      this: T,
      value: Expand<Serialized>,
    ): InstanceType<T> {
      return new (this as any)(
        ($Multiple as any).$deserialize(value),
      ) as InstanceType<T>;
    }

    static $deserialize<T extends typeof $Multiple>(
      this: T,
      value: Serialized,
    ): InstanceType<T> {
      return (value as any).map(longhand.$deserialize);
    }

    static $serialize(value: Inline): Serialized {
      return (value as any).map(longhand.$serialize as any);
    }

    [Symbol.iterator]() {
      return this.value[Symbol.iterator]();
    }

    static $inline: Inline;
  }

  const forwarded = forward($Multiple, [
    "map",
    "reduce",
    "filter",
    "forEach",
    "some",
    "every",
    "find",
    "findIndex",
    "indexOf",
    "lastIndexOf",
    "includes",
    "keys",
    "values",
    "entries",
    "length",
    "at",
    "concat",
    "flat",
    "splice",
    "flatMap",
    "push",
    "pop",
    "sort",
    "slice",
  ] as const);

  type MultipleConstructor = abstract new (
    value: Expand<Inline>,
  ) => InstanceType<B> & $Multiple & InstanceType<typeof forwarded>;

  type Multiple = Omit<B, "prototype"> &
    Omit<typeof forwarded, ""> &
    MultipleConstructor;

  return forwarded as any as Multiple;
};
