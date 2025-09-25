import { AbstractConstructor, Empty, Constructor, Expand } from "./_";

export type ClassShorthand = Constructor<{ serialize(): any }> & {
  deserialize(value: any): any;
};

export const Class = <
  S extends Constructor<{ serialize(): any }> & {
    deserialize(value: any): any;
  },
  B extends AbstractConstructor<any> = typeof Empty,
>(
  of: S,
  base = Empty,
): IClass<S, B> => {
  type Serialized = ReturnType<InstanceType<S>["serialize"]>;
  type Inline = InstanceType<S>;

  abstract class $Class extends base {
    static $shape = "class" as const;
    static $of = of;

    constructor(public value: InstanceType<B>) {
      super();
    }

    static deserialize<T extends Constructor<any>>(
      this: T,
      value: Expand<Parameters<S["deserialize"]>[0]>,
    ): InstanceType<T> {
      return new this(of.deserialize(value)) as InstanceType<T>;
    }

    serialize<T extends $Class>(this: T): Expand<Serialized> {
      return this.value.serialize();
    }

    static $deserialize(value: Parameters<S["deserialize"]>[0]): Inline {
      return of.deserialize(value);
    }

    static $serialize<T extends typeof $Class>(
      this: T,
      value: Inline,
    ): Serialized {
      return value.serialize();
    }

    static $inline: Inline;
  }

  return $Class as any;
};

export type IClass<
  S extends ClassShorthand,
  B extends AbstractConstructor<any> = typeof Empty,
> = (abstract new (
  value: InstanceType<B>,
) => {
  value: InstanceType<B>;
  serialize<T>(this: T): Expand<ReturnType<InstanceType<S>["serialize"]>>;
}) & {
  $shape: "class";
  $of: S;
  deserialize<T extends Constructor<any>>(
    this: T,
    value: Expand<Parameters<S["deserialize"]>[0]>,
  ): InstanceType<T>;
  $deserialize(value: Parameters<S["deserialize"]>[0]): InstanceType<S>;
  $serialize<T>(
    this: T,
    value: InstanceType<S>,
  ): ReturnType<InstanceType<S>["serialize"]>;
  $inline: InstanceType<S>;
};
