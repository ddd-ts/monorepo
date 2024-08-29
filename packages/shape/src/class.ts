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
) => {
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
      value: Expand<Serialized>,
    ): InstanceType<T> {
      return new this(of.deserialize(value)) as InstanceType<T>;
    }

    serialize<T extends $Class>(this: T): Expand<Serialized> {
      return this.value.serialize();
    }

    static $deserialize(value: Serialized): Inline {
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

  type Class = typeof $Class;

  return $Class as Class;
};
