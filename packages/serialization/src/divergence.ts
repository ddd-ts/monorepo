export type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

// OBJECT
export type Expand<T> = T extends infer O
  ? { [K in keyof O]: O[K] } & {}
  : never;
type Access<T, K> = K extends keyof T ? T[K] : never;
type OnlyFromKeys<From, To> = Exclude<Exclude<keyof From, keyof To>, symbol>;
type OnlyToKeys<From, To> = Exclude<Exclude<keyof To, keyof From>, symbol>;
type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
} & {};

type ObjectDivergence<From, To, Acc extends any[]> = OmitNever<
  {
    [K in keyof From & keyof To]: Divergence<
      Access<From, K>,
      Access<To, K>,
      Acc
    >;
  } & {
    [K in OnlyFromKeys<From, To> as `+${K}`]: From[K];
  } & {
    [K in OnlyToKeys<From, To> as `-${K}`]: To[K];
  }
> extends infer Result
  ? {} extends Result
    ? never
    : Result
  : never;

// INDEXED
type IndexedTypeKey<From, To> = ({
  [K in keyof From]: K;
} & {
  [K in keyof To]: K;
})[keyof From | keyof To];

type IndexedTypeDiff<From, To, Acc extends any[]> = IndexedTypeKey<
  From,
  To
> extends infer U extends keyof From & keyof To
  ? Divergence<From[U], To[U], Acc>
  : never;
type IsIndexedType<T> = [T] extends [never]
  ? false
  : T extends object
    ? string extends keyof T
      ? true
      : number extends keyof T
        ? true
        : symbol extends keyof T
          ? true
          : false
    : false;

// UNION
type CountUnion<T> = UnionToArray<T> extends infer U extends any[]
  ? U["length"]
  : never;

type UnshiftUnion<U> = UnionToArray<U> extends [infer F, ...any[]] ? F : never;

type FindBestKeyForMatching<Union> = UnshiftUnion<
  keyof Union extends infer K
    ? K extends keyof Union
      ? CountUnion<Pick<Union, K>[K]> extends CountUnion<Union>
        ? K
        : never
      : never
    : never
>;

type DiffBestMatchForObject<
  Item,
  Union,
  K,
  Acc extends any[],
> = IsNever<K> extends false
  ? K extends keyof Union & keyof Item
    ? Extract<Union, { [P in K]: Item[P] }> extends infer BestMatch
      ? IsNever<BestMatch> extends false
        ? Divergence<Item, BestMatch, Acc> extends infer D
          ? IsNever<D> extends false
            ? Expand<{ [P in K]: Item[P] } & D>
            : never
          : never
        : never
      : never
    : never
  : never;

type DiffBestMatch<Item, Union, BestKey, Acc extends any[]> = PopUnion<
  Item extends object
    ? DiffBestMatchForObject<Item, Extract<Union, object>, BestKey, Acc>
    : never
>;

type PerfectMatch<Item, Union, TotalUnion, Acc extends any[]> = Union extends [
  infer F,
  ...infer R,
]
  ? Divergence<Item, F, Acc> extends infer D
    ? IsNever<D> extends true
      ? F
      : PerfectMatch<Item, R, TotalUnion, Acc>
    : "!![PerfectMatch] Could not infer D"
  : never; // end of recursion

type GetChange<Item, Union, BestKey, Acc extends any[]> = PerfectMatch<
  Item,
  UnionToArray<Union>,
  BestKey,
  Acc
> extends infer P
  ? IsNever<P> extends false
    ? never
    : DiffBestMatch<Item, Union, BestKey, Acc> extends infer D
      ? IsNever<D> extends false
        ? { "~": D }
        : { "+": Item }
      : "!![GetChange] Could not infer D"
  : "!![GetChange] Could not infer P";

export type ArrayUnionDivergence<
  From,
  To,
  BestKey,
  Acc extends any[],
  Divergences extends { "~": unknown; "+": unknown } = {
    "~": never;
    "+": never;
  },
> = From extends [infer F, ...infer Rest]
  ? GetChange<F, To, BestKey, Acc> extends infer Change
    ? IsNever<Change> extends true
      ? ArrayUnionDivergence<Rest, To, BestKey, Acc, Divergences>
      : Change extends { "+": infer A }
        ? ArrayUnionDivergence<
            Rest,
            To,
            BestKey,
            Acc,
            { "~": Divergences["~"]; "+": Divergences["+"] | A }
          >
        : Change extends { "~": infer C }
          ? ArrayUnionDivergence<
              Rest,
              To,
              BestKey,
              Acc,
              { "~": Divergences["~"] | C; "+": Divergences["+"] }
            >
          : never
    : ArrayUnionDivergence<Rest, To, BestKey, Acc, Divergences>
  : OmitNever<Divergences> extends infer Result
    ? {} extends Result
      ? never
      : Result
    : never;

export type UnionDivergence<From, To, Acc extends any[]> = ArrayUnionDivergence<
  UnionToArray<From>,
  To,
  FindBestKeyForMatching<Extract<To, object>>,
  Acc
>;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

type IsAtLeastOneUnion<L, R> = IsUnion<L> extends true
  ? true
  : IsUnion<R> extends true
    ? true
    : false;

export type IsNever<T> = [T] extends [never] ? true : false;

type AtLeastOneEmptyObject<L, R> = {} extends L
  ? true
  : {} extends R
    ? true
    : false;

type EmptyObjectDivergence<From, To> = [{}, {}] extends [From, To]
  ? never
  : [From, "!=", To];

type SimpleDivergence<From, To> = From extends To ? never : [From, "!=", To];

type UnionToOvlds<U> = UnionToIntersection<
  U extends any ? (f: U) => void : never
>;

export type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? A
  : never;

export type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
  ? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
  : [T, ...A];

// ARRAY

type AtLeastOneArray<From, To> = From extends Array<unknown>
  ? true
  : To extends Array<unknown>
    ? true
    : false;

type ArrayDivergence<From, To, Acc extends any[]> = From extends Array<infer F>
  ? To extends Array<infer T>
    ? Divergence<F, T, Acc> extends infer D
      ? IsNever<D> extends true
        ? never
        : { [key: number]: D }
      : never
    : ["[]?", Divergence<F, To, Acc>]
  : To extends Array<infer T>
    ? ["[]!", Divergence<From, T, Acc>]
    : never;

type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T
  ? 1
  : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;

type Has<Item, Array extends any[]> = Array extends [infer F, ...infer R]
  ? IfEquals<Item, F, true, Has<Item, R>>
  : false;

type Primitive = string | number | boolean | null | undefined | Date;

type AtLeastOnePrimitive<From, To> = From extends Primitive
  ? true
  : To extends Primitive
    ? true
    : false;

type PrimitiveDivergence<From, To> = AtLeastOnePrimitive<From, To> extends true
  ? SimpleDivergence<From, To>
  : never;

// DIVERGENCE
export type Divergence<
  From,
  To,
  Acc extends any[] = [],
> = Acc["length"] extends 20
  ? { error: "Max depth reached" }
  : Has<From, [To, ...Acc]> extends true
    ? never
    : [IsNever<From>, IsNever<To>] extends [false, false]
      ? AtLeastOneArray<From, To> extends true
        ? ArrayDivergence<From, To, [...Acc, From]>
        : [IsIndexedType<From>, IsIndexedType<To>] extends [true, true]
          ? IndexedTypeDiff<From, To, [...Acc, From]>
          : IsAtLeastOneUnion<From, To> extends true
            ? UnionDivergence<From, To, Acc>
            : AtLeastOnePrimitive<From, To> extends true
              ? PrimitiveDivergence<From, To>
              : AtLeastOneEmptyObject<From, To> extends true
                ? EmptyObjectDivergence<From, To>
                : [From, To] extends [object, object]
                  ? ObjectDivergence<From, To, [...Acc, From]>
                  : SimpleDivergence<From, To>
      : {};
