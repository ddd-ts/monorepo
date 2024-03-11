import {
  Concrete,
  Constructor,
  Expand,
  DefinitionOf,
  Shape,
  AbstractConstructor,
  Empty,
  Shorthand,
} from "./_";
import { ClassShorthand } from "./class";
import { LiteralShorthand } from "./literal";

type StrToNumber<T> = T extends `${infer U extends number}` ? U : never;

export type EitherConfiguration = (LiteralShorthand | ClassShorthand)[];

export const Either = <
  const S extends EitherConfiguration,
  const B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
) => {
  type Serialized = {
    [K in keyof S]: [
      StrToNumber<K>,
      ReturnType<DefinitionOf<S[K]>["$serialize"]>,
    ];
  }[number];

  type Inline = DefinitionOf<S[number]>["$inline"];

  const definitions = (of as any).map((i: any) => Shape(i));

  abstract class $Either extends (base as any as Constructor<{}>) {
    constructor(public value: Inline) {
      super();
    }

    static of = of;

    static $name = "either" as const;

    serialize(): Expand<Serialized> {
      return ($Either as any).$serialize(this.value) as any;
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
      const [index, serialized] = value as any;
      const definition = definitions[index];
      if (!definition) {
        throw new Error("Cannot deserialize Either");
      }
      return (definition as any).$deserialize(serialized);
    }

    static $serialize<T extends typeof $Either>(
      this: T,
      value: Inline,
    ): Serialized {
      const index = of.indexOf((value as any).constructor as any);
      const definition = definitions[index];
      if (!definition) {
        throw new Error("Cannot serialize Either");
      }
      return [index, (definition as any).$serialize(value)] as any;
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
