import {
  type DefinitionOf,
  type Shorthand,
  Shape,
  type Expand,
  type AbstractConstructor,
  type Constructor,
  Empty,
} from "./_";

export type DictShorthand = { [key: string]: Shorthand };

type Internal<S extends DictShorthand, B extends AbstractConstructor<{}>> = {
  Definition: { -readonly [K in keyof S]: DefinitionOf<S[K]> };
  Serialized: (B extends { $name: infer U } ? { $name: U } : {}) & {
    -readonly [K in keyof S]: ReturnType<DefinitionOf<S[K]>["$serialize"]>;
  };
  Deserializing: (B extends { $name: infer U } ? { $name: U } : {}) & {
    -readonly [K in keyof S]: Parameters<DefinitionOf<S[K]>["$deserialize"]>[0];
  };
  Inline: {
    -readonly [K in keyof S]: DefinitionOf<S[K]>["$inline"];
  };
};

export const Dict = <
  const S extends { [key: string]: any },
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
): IDict<S, B> => {
  abstract class $Dict extends (base as any as AbstractConstructor<{}>) {
    static $shape = "dict" as const;
    static $of = of;

    constructor(...args: any[]) {
      super();
      Object.assign(this, args[0]);
    }

    serialize() {
      return $Dict.$serialize(this as any) as any;
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: any,
    ): InstanceType<T> {
      const runtime = (this as any).$deserialize(value as any);
      return new this(runtime as any) as any;
    }

    static $deserialize<T extends typeof $Dict>(this: T, value: any): any {
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
    ): any {
      const split = Object.entries(of);
      const transform = split.map(([key, child]) => {
        const longhand = Shape(child as any) as any;
        const serialized = longhand.$serialize((value as any)[key]);
        return [key, serialized];
      });
      const merge = Object.fromEntries(transform);

      if ("$name" in base) {
        return { ...merge, $name: base.$name } as any;
      }

      return merge as any;
    }
  }

  return $Dict as any;
};

export type IDict<
  S extends {
    [key: string]: any;
  },
  B extends AbstractConstructor<{}> = typeof Empty,
> = Omit<B, ""> & {
  $shape: "dict";
  $of: S;
  deserialize<T extends Constructor>(
    this: T,
    value: Expand<Internal<S, B>["Serialized"]>,
  ): InstanceType<T>;
  $deserialize<T>(
    this: T,
    value: Internal<S, B>["Deserializing"],
  ): Internal<S, B>["Inline"];
  $serialize<T extends Constructor>(
    this: T,
    value: InstanceType<T>,
  ): Internal<S, B>["Serialized"];
  $inline: Internal<S, B>["Inline"];
} & (abstract new (
    value: Expand<Internal<S, B>["Inline"]>,
  ) => InstanceType<B> & {
    serialize(): Expand<Internal<S, B>["Serialized"]>;
  } & Internal<S, B>["Inline"]);
