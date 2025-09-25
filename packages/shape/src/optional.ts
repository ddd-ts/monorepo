import {
  Definition,
  Expand,
  Shorthand,
  DefinitionOf,
  Shape,
  Constructor,
  AbstractConstructor,
  Empty,
} from "./_";

export type OptionalConfiguration = Definition | Shorthand;

type Matcher<V> = { some: (value: V) => any; none: () => any };

type Internal<S extends Definition | Shorthand> = {
  Serialized: ReturnType<DefinitionOf<S>["$serialize"]> | undefined;
  Deserializing: Parameters<DefinitionOf<S>["$deserialize"]>[0] | undefined;
  Inline: Expand<DefinitionOf<S>["$inline"]> | undefined;
  Required: Expand<DefinitionOf<S>["$inline"]>;
};

export const Optional = <
  S extends Definition | Shorthand,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
): IOptional<S, B> => {
  abstract class $Optional extends (base as any as Constructor<{}>) {
    constructor(public value: any) {
      super();
    }

    static $shape = "optional" as const;

    serialize() {
      return $Optional.$serialize((this as any).value) as any;
    }

    match(config: any) {
      if ((this as any).value === undefined) {
        return config.none();
      }
      return config.some((this as any).value);
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: any,
    ): InstanceType<T> {
      return new (this as any)((this as any).$deserialize(value)) as any;
    }

    static $deserialize(value: any): any {
      if (value === undefined) {
        return undefined;
      }
      return (Shape(of) as any).$deserialize(value);
    }

    static $serialize<T extends typeof $Optional>(this: T, value: any): any {
      return value === undefined
        ? undefined
        : (Shape(of) as any).$serialize(value);
    }

    static $inline: any;
  }

  return $Optional as any;
};

export type IOptional<
  S extends Definition | Shorthand,
  B extends AbstractConstructor<{}> = typeof Object,
> = Omit<B, "prototype"> & {
  $shape: "optional";
  deserialize<T extends Constructor>(
    this: T,
    value: Internal<S>["Deserializing"],
  ): InstanceType<T>;
  $deserialize(value: Internal<S>["Deserializing"]): Definition["$inline"];
  $serialize<T>(
    this: T,
    value: Internal<S>["Inline"],
  ): Internal<S>["Serialized"];
  $inline: Internal<S>["Inline"];
} & (abstract new (
    value: Internal<S>["Inline"],
  ) => InstanceType<B> & {
    value: Internal<S>["Inline"];
    serialize(): Expand<Internal<S>["Serialized"]>;
    match<M extends Matcher<Expand<Internal<S>["Required"]>>>(
      config: M,
    ): ReturnType<M["some"]> | ReturnType<M["none"]>;
  });
