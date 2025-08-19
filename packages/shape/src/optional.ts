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
  Inline: Expand<DefinitionOf<S>["$inline"]> | undefined;
  Required: Expand<DefinitionOf<S>["$inline"]>;
};

export const Optional = <
  S extends Definition | Shorthand,
  B extends AbstractConstructor<{}> = typeof Empty,
  Cache extends Internal<S> = Internal<S>,
>(
  of: S,
  base: B = Empty as any,
) => {
  const definition = Shape(of) as Definition;

  abstract class $Optional extends (base as any as Constructor<{}>) {
    constructor(public value: Cache["Inline"]) {
      super();
    }

    static $shape = "optional" as const;

    serialize(): Expand<Cache["Serialized"]> {
      return $Optional.$serialize((this as any).value) as any;
    }

    match<M extends Matcher<Expand<Cache["Required"]>>>(
      config: M,
    ): ReturnType<M["some"]> | ReturnType<M["none"]> {
      if ((this as any).value === undefined) {
        return config.none();
      }
      return config.some((this as any).value);
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: Cache["Inline"],
    ): InstanceType<T> {
      return new (this as any)((this as any).$deserialize(value)) as any;
    }

    static $deserialize(value: Cache["Serialized"]): Definition["$inline"] {
      if (value === undefined) {
        return undefined;
      }
      return definition.$deserialize(value);
    }

    static $serialize<T extends typeof $Optional>(
      this: T,
      value: Cache["Inline"],
    ): Cache["Serialized"] {
      return value === undefined ? undefined : definition.$serialize(value);
    }

    static $inline: Cache["Inline"];
  }

  type OptionalConstructor = abstract new (
    value: Expand<Cache["Inline"]>,
  ) => InstanceType<B> & $Optional;

  type Optional = Omit<B, "prototype"> &
    Omit<typeof $Optional, ""> &
    OptionalConstructor;

  return $Optional as any as Optional;
};
