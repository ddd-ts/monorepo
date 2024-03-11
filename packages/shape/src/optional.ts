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

export const Optional = <
  S extends Definition | Shorthand,
  B extends AbstractConstructor<{}> = typeof Empty,
>(
  of: S,
  base: B = Empty as any,
) => {
  type Definition = DefinitionOf<S, B>;
  type Serialized = ReturnType<Definition["$serialize"]> | undefined;

  abstract class $Optional extends (base as any as Constructor<{}>) {
    constructor(public value: Expand<Definition["$inline"]> | undefined) {
      super();
    }

    static $name = "optional" as const;

    serialize(): Expand<Serialized> {
      return $Optional.$serialize((this as any).value) as any;
    }

    match<M extends Matcher<Expand<Definition["$inline"]>>>(
      config: M,
    ): ReturnType<M["some"]> | ReturnType<M["none"]> {
      if ((this as any).value === undefined) {
        return config.none();
      }
      return config.some((this as any).value);
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: Definition["$inline"] | undefined,
    ): InstanceType<T> {
      return new (this as any)((this as any).$deserialize(value)) as any;
    }

    static $deserialize(
      value: ReturnType<Definition["$serialize"]> | undefined,
    ): Definition["$inline"] | undefined {
      if (value === undefined) {
        return undefined;
      }
      return (Shape(of) as any).$deserialize(value);
    }

    static $serialize<T extends typeof $Optional>(
      this: T,
      value: Definition["$inline"] | undefined,
    ): ReturnType<Definition["$serialize"]> | undefined {
      return value ? (Shape(of) as any).$serialize(value) : undefined;
    }

    static $inline: Definition["$inline"] | undefined;
  }

  type OptionalConstructor = abstract new (
    value: Expand<Definition["$inline"]> | undefined,
  ) => InstanceType<B> & $Optional;

  type Optional = Omit<B, "prototype"> &
    Omit<typeof $Optional, ""> &
    OptionalConstructor;

  return $Optional as any as Optional;
};
