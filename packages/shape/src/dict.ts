import {
  DefinitionOf,
  Shorthand,
  Shape,
  Concrete,
  Expand,
  AbstractConstructor,
  Constructor,
  Empty,
} from "./_";

export type DictShorthand = { [key: string]: Shorthand };

export const Dict = <
  const S extends { [key: string]: any },
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  definition: S,
  base: B = Empty as any,
) => {
  type Def = { -readonly [K in keyof S]: DefinitionOf<S[K], B> };

  type Serialized = {
    -readonly [K in keyof S]: ReturnType<Def[K]["$serialize"]>;
  };
  type Inline = {
    -readonly [K in keyof Def]: Def[K]["$inline"];
  };

  abstract class $Dict extends (base as any as AbstractConstructor<{}>) {
    static $name = "dict" as const;

    constructor(...args: any[]) {
      super();
      Object.assign(this, args[0]);
    }

    serialize(): Expand<Serialized> {
      return $Dict.$serialize(this as any) as any;
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: Expand<Serialized>,
    ): InstanceType<T> {
      const runtime = (this as any).$deserialize(value as any);
      return new this(runtime as any) as any;
    }

    static $deserialize<T extends typeof $Dict>(
      this: T,
      value: Serialized,
    ): Inline {
      const split = Object.entries(definition);
      const transform = split.map(([key, child]) => {
        const longhand = Shape(child) as any;
        const deserialized = longhand.$deserialize((value as any)[key]);
        return [key, deserialized];
      });
      const merge = Object.fromEntries(transform);
      return merge;
    }

    static $serialize<T extends typeof $Dict>(
      this: T,
      value: InstanceType<T>,
    ): Serialized {
      const split = Object.entries(definition);
      const transform = split.map(([key, child]) => {
        const longhand = Shape(child as any) as any;
        const serialized = longhand.$serialize((value as any)[key]);
        return [key, serialized];
      });
      const merge = Object.fromEntries(transform);
      return merge as any;
    }

    static $inline: Inline;
  }

  type DictConstructor = abstract new (
    value: Expand<Inline>,
  ) => InstanceType<B> & $Dict & Inline;
  type WithConstructor = Omit<B, ""> & Omit<typeof $Dict, ""> & DictConstructor;
  return $Dict as any as WithConstructor;
};
