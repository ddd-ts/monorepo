import {
  type Definition,
  type Expand,
  type Shorthand,
  type DefinitionOf,
  Shape,
  type AbstractConstructor,
  Empty,
  type Constructor,
} from "./_";

type MappingLiteralKey = [
  [StringConstructor, string],
  [NumberConstructor, number],
];
type MappingKeyConstructor = MappingLiteralKey[number][0];
type MappingKeyRuntimeFromConstructor<S extends MappingKeyConstructor> =
  S extends StringConstructor ? string : number;

export type MappingConfiguration =
  | [MappingKeyConstructor, Definition | Shorthand]
  | [Definition | Shorthand];

type MappingOf<C extends MappingConfiguration> = C extends [
  infer K extends MappingKeyConstructor,
  infer V extends Definition | Shorthand,
]
  ? { key: K; value: DefinitionOf<V> }
  : C extends [infer V extends Definition | Shorthand]
    ? { key: StringConstructor; value: DefinitionOf<V> }
    : never;

type Internal<
  C extends MappingConfiguration,
  B extends AbstractConstructor<{}>,
> = {
  Definition: MappingOf<C>["value"];
  Serialized: Record<
    MappingKeyRuntimeFromConstructor<MappingOf<C>["key"]>,
    ReturnType<MappingOf<C>["value"]["$serialize"]>
  >;
  Deserializing: Record<
    MappingKeyRuntimeFromConstructor<MappingOf<C>["key"]>,
    Parameters<MappingOf<C>["value"]["$deserialize"]>[0]
  >;
  Inline: Record<
    MappingKeyRuntimeFromConstructor<MappingOf<C>["key"]>,
    MappingOf<C>["value"]["$inline"]
  >;
};

export const Mapping = <
  C extends MappingConfiguration,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  config: C,
  base: B = Empty as any,
): Mapping<C, B> => {
  let [, _value] = config;
  if (config.length === 1) {
    _value = config[0];
  }

  const $value = _value;

  type Definition = MappingOf<C>["value"];
  type K = MappingOf<C>["key"];
  type Key = MappingKeyRuntimeFromConstructor<K>;
  type Serialized = Record<Key, ReturnType<Definition["$serialize"]>>;
  type Inline = Record<Key, Definition["$inline"]>;

  abstract class $Mapping extends (base as any as Constructor<{}>) {
    constructor(public value: Inline) {
      super();
    }

    static $shape = "mapping" as const;

    serialize(): Expand<Serialized> {
      return $Mapping.$serialize(this.value) as any;
    }

    static deserialize<T extends typeof $Mapping>(
      this: T,
      value: Expand<Serialized>,
    ): InstanceType<T> {
      return new (this as any)(($Mapping as any).$deserialize(value)) as any;
    }

    static $deserialize<T extends typeof $Mapping>(
      this: T,
      value: Serialized,
    ): Inline {
      const split = Object.entries(value);
      const transform = split.map(([key, child]) => {
        const longhand = Shape(_value) as any;
        const deserialized = longhand.$deserialize(child as any);
        return [key, deserialized] as const;
      });
      return Object.fromEntries(transform) as any;
    }

    static $serialize<T extends typeof $Mapping>(
      this: T,
      value: Inline,
    ): Serialized {
      const split = Object.entries(value);
      const transform = split.map(([key, child]) => {
        const longhand = Shape($value) as any;
        const serialized = longhand.$serialize(child as any);
        return [key, serialized];
      });
      const merge = Object.fromEntries(transform);
      return merge;
    }

    static $inline: Inline;
  }

  return $Mapping as any;
};

export type Mapping<
  C extends MappingConfiguration,
  B extends AbstractConstructor<{}> = typeof Empty,
> = Omit<B, "prototype"> &
  (abstract new (
    value: Internal<C, B>["Inline"],
  ) => InstanceType<B> & {
    value: Internal<C, B>["Inline"];
    serialize(): Expand<Internal<C, B>["Serialized"]>;
  }) & {
    $shape: "mapping";
    deserialize<T extends Constructor>(
      this: T,
      value: Expand<Internal<C, B>["Serialized"]>,
    ): InstanceType<T>;
    $deserialize<T>(
      this: T,
      value: Internal<C, B>["Deserializing"],
    ): Internal<C, B>["Inline"];
    $serialize<T>(
      this: T,
      value: Internal<C, B>["Inline"],
    ): Internal<C, B>["Serialized"];
    $inline: Internal<C, B>["Inline"];
  };
