import {
  Definition,
  Expand,
  Shorthand,
  DefinitionOf,
  Shape,
  AbstractConstructor,
  Empty,
  Constructor,
} from "./_";
import { Primitive } from "./primitive";

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

export const Mapping = <
  C extends MappingConfiguration,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  config: C,
  base: B = Empty as any,
) => {
  let [_key, _value] = config;
  if (config.length === 1) {
    _key = Primitive(String);
    _value = config[0];
  }

  const { $key, $value } = { $key: _key, $value: _value };

  type Definition = MappingOf<C>["value"];
  type K = MappingOf<C>["key"];
  type Key = MappingKeyRuntimeFromConstructor<K>;
  type Serialized = Record<Key, ReturnType<Definition["$serialize"]>>;
  type Inline = Record<Key, Definition["$inline"]>;

  abstract class $Mapping extends (base as any as Constructor<{}>) {
    constructor(public value: Inline) {
      super();
    }

    static $name = "mapping" as const;

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

  type MappingConstructor = abstract new (
    value: Expand<Inline>,
  ) => InstanceType<B> & $Mapping;

  type Mapping = Omit<B, "prototype"> &
    Omit<typeof $Mapping, "prototype"> &
    MappingConstructor;

  return $Mapping as any as Mapping;
};
