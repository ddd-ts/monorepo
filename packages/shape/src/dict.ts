import {
  DefinitionOf,
  Shorthand,
  Shape,
  Expand,
  AbstractConstructor,
  Constructor,
  Empty,
} from "./_";

export type DictShorthand = { [key: string]: Shorthand };

type Internal<S extends DictShorthand, B extends AbstractConstructor<{}>> = {
  Definition: { -readonly [K in keyof S]: DefinitionOf<S[K]> };
  Serialized: (B extends { $kind: infer U } ? { $kind: U } : {}) & {
    -readonly [K in keyof S]: ReturnType<DefinitionOf<S[K]>["$serialize"]>;
  };
  Inline: {
    -readonly [K in keyof S]: DefinitionOf<S[K]>["$inline"];
  };
};

export const Dict = <
  const S extends { [key: string]: any },
  B extends AbstractConstructor<{}> = typeof Empty,
  Cache extends Internal<S, B> = Internal<S, B>,
>(
  of: S,
  base: B = Empty as any,
) => {
  abstract class $Dict extends (base as any as AbstractConstructor<{}>) {
    static $shape = "dict" as const;
    static $of = of;

    constructor(...args: any[]) {
      super();
      Object.assign(this, args[0]);
    }

    serialize(): Expand<Cache["Serialized"]> {
      return $Dict.$serialize(this as any) as any;
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: Expand<Cache["Serialized"]>,
    ): InstanceType<T> {
      const runtime = (this as any).$deserialize(value as any);
      return new this(runtime as any) as any;
    }

    static $deserialize<T extends typeof $Dict>(
      this: T,
      value: Cache["Serialized"],
    ): Cache["Inline"] {
      const split = Object.entries(of);
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
    ): Cache["Serialized"] {
      const split = Object.entries(of);
      const transform = split.map(([key, child]) => {
        const longhand = Shape(child as any) as any;
        const serialized = longhand.$serialize((value as any)[key]);
        return [key, serialized];
      });
      const merge = Object.fromEntries(transform);

      if ("$kind" in base) {
        return { ...merge, $kind: base.$kind } as any;
      }

      return merge as any;
    }

    static $inline: Cache["Inline"];
  }

  type DictConstructor = abstract new (
    value: Expand<Cache["Inline"]>,
  ) => InstanceType<B> & $Dict & Cache["Inline"];
  type WithConstructor = Omit<B, ""> & Omit<typeof $Dict, ""> & DictConstructor;
  return $Dict as any as WithConstructor;
};
