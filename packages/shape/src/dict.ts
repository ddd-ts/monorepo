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
  S extends { [key: string]: any },
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  definition: S,
  base: B = Empty as any,
) => {
  type Def = { [K in keyof S]: DefinitionOf<S[K]> };

  type Serialized = {
    [K in keyof S]: ReturnType<Def[K]["$serialize"]>;
  };
  type Inline = {
    [K in keyof Def]: Def[K]["$inline"];
  };

  abstract class $Dict extends (base as any) {
    static $name = "dict" as const;

    static shape: S;
    static serialized: {
      [K in keyof S]: DefinitionOf<S[K]>;
    };

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

    static $deserialize<T extends Concrete<typeof $Dict>>(
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
  type WithConstructor = Omit<B, "prototype"> & typeof $Dict & DictConstructor;
  return $Dict as any as WithConstructor;
};