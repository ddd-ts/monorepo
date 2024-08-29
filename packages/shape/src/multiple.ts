import {
  Definition,
  Expand,
  Shorthand,
  DefinitionOf,
  Shape,
  AbstractConstructor,
  Empty,
  Constructor,
} from "./_";

export type MultipleConfiguration = Definition | Shorthand;
export type MultipleShorthand = [any] | readonly [any];

type Internal<S extends MultipleConfiguration> = {
  Serialized: ReturnType<DefinitionOf<S>["$serialize"]>[];
  Inline: DefinitionOf<S>["$inline"][];
};

export const Multiple = <
  const S extends MultipleConfiguration,
  B extends AbstractConstructor<{}> = typeof Empty,
  Cache extends Internal<S> = Internal<S>,
>(
  of: S,
  base: B = Empty as any,
) => {
  const longhand = Shape(of);

  abstract class $Multiple extends (base as any as Constructor<{}>) {
    constructor(public value: Cache["Inline"]) {
      super();
    }
    static $shape = "multiple" as const;

    serialize(): Expand<Cache["Serialized"]> {
      return $Multiple.$serialize(this.value) as any;
    }

    static deserialize<T extends Constructor>(
      this: T,
      value: Expand<Cache["Serialized"]>,
    ): InstanceType<T> {
      return new (this as any)(
        ($Multiple as any).$deserialize(value),
      ) as InstanceType<T>;
    }

    static $deserialize<T extends Constructor>(
      this: T,
      value: Cache["Serialized"],
    ): InstanceType<T> {
      return (value as any).map(longhand.$deserialize);
    }

    static $serialize(value: Cache["Inline"]): Cache["Serialized"] {
      return (value as any).map(longhand.$serialize as any);
    }

    [Symbol.iterator]() {
      return this.value[Symbol.iterator]();
    }

    static $inline: Cache["Inline"];

    get map() {
      return this.value.map.bind(this.value);
    }

    get reduce() {
      return this.value.reduce.bind(this.value);
    }

    get filter() {
      return this.value.filter.bind(this.value);
    }

    get forEach() {
      return this.value.forEach.bind(this.value);
    }

    get some() {
      return this.value.some.bind(this.value);
    }

    get every() {
      return this.value.every.bind(this.value);
    }

    get find() {
      return this.value.find.bind(this.value);
    }

    get findIndex() {
      return this.value.findIndex.bind(this.value);
    }

    get indexOf() {
      return this.value.indexOf.bind(this.value);
    }

    get lastIndexOf() {
      return this.value.lastIndexOf.bind(this.value);
    }

    get includes() {
      return this.value.includes.bind(this.value);
    }

    get keys() {
      return this.value.keys.bind(this.value);
    }

    get values() {
      return this.value.values.bind(this.value);
    }

    get entries() {
      return this.value.entries.bind(this.value);
    }

    get at() {
      return this.value.at.bind(this.value);
    }

    get concat() {
      return this.value.concat.bind(this.value);
    }

    get flat() {
      return this.value.flat.bind(this.value);
    }

    get splice() {
      return this.value.splice.bind(this.value);
    }

    get flatMap() {
      return this.value.flatMap.bind(this.value);
    }

    get push() {
      return this.value.push.bind(this.value);
    }

    get pop() {
      return this.value.pop.bind(this.value);
    }

    get sort() {
      return this.value.sort.bind(this.value);
    }

    get slice() {
      return this.value.slice.bind(this.value);
    }

    get length() {
      return this.value.length;
    }
  }

  type MultipleConstructor = abstract new (
    value: Expand<Cache["Inline"]>,
  ) => InstanceType<B> & $Multiple;

  type Multiple = Omit<B, "prototype"> &
    Omit<typeof $Multiple, ""> &
    MultipleConstructor;

  return $Multiple as any as Multiple;
};
