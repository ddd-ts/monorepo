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
>(
  of: S,
  base: B = Empty as any,
): IMultiple<S, B> => {
  const longhand = Shape(of);

  abstract class $Multiple extends (base as any as Constructor<{}>) {
    constructor(public value: any[]) {
      super();
    }
    static $shape = "multiple" as const;

    serialize() {
      return $Multiple.$serialize(this.value);
    }

    static deserialize(value: any) {
      return new (this as any)(($Multiple as any).$deserialize(value));
    }

    static $deserialize(value: any) {
      return (value as any).map(longhand.$deserialize);
    }

    static $serialize(value: any) {
      return (value as any).map(longhand.$serialize as any);
    }

    [Symbol.iterator]() {
      return this.value[Symbol.iterator]();
    }

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

    get fill() {
      return this.value.fill.bind(this.value);
    }

    get copyWithin() {
      return this.value.copyWithin.bind(this.value);
    }

    get reverse() {
      return this.value.reverse.bind(this.value);
    }

    get shift() {
      return this.value.shift.bind(this.value);
    }

    get unshift() {
      return this.value.unshift.bind(this.value);
    }
  }

  return $Multiple as any;
};

export type IMultiple<
  S extends MultipleConfiguration,
  B extends AbstractConstructor<{}> = typeof Empty,
> = Omit<B, "prototype"> &
  (abstract new (
    value: Internal<S>["Inline"],
  ) => InstanceType<B> &
    Pick<
      Internal<S>["Inline"],
      | "at"
      | "length"
      | "concat"
      | "copyWithin"
      | "entries"
      | "every"
      | "fill"
      | "filter"
      | "find"
      | "findIndex"
      | "flat"
      | "flatMap"
      | "forEach"
      | "includes"
      | "indexOf"
      | "join"
      | "keys"
      | "lastIndexOf"
      | "map"
      | "pop"
      | "push"
      | "reduce"
      | "reduceRight"
      | "reverse"
      | "shift"
      | "slice"
      | "some"
      | "sort"
      | "splice"
      | "unshift"
      | "values"
      | typeof Symbol.iterator
    > & {
      value: Internal<S>["Inline"];
      serialize(): Expand<Internal<S>["Serialized"]>;
    }) & {
    $shape: "multiple";
    deserialize<T extends Constructor>(
      this: T,
      value: Expand<Internal<S>["Serialized"]>,
    ): InstanceType<T>;
    $deserialize<T extends Constructor>(
      this: T,
      value: Internal<S>["Serialized"],
    ): InstanceType<T>;
    $serialize(value: Internal<S>["Inline"]): Internal<S>["Serialized"];
    $inline: Internal<S>["Inline"];
  };
