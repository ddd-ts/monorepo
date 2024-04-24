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
type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] };

type ObjectDivergence<From, To> = OmitNever<
  {
    [K in keyof From & keyof To]: Expand<
      Divergence<Access<From, K>, Access<To, K>>
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

type IndexedTypeDiff<From, To> = IndexedTypeKey<
  From,
  To
> extends infer U extends keyof From & keyof To
  ? Divergence<From[U], To[U]>
  : never;
type IsIndexedType<T> = [T] extends [never]
  ? false
  : T extends object
    ? number extends keyof T
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

type DiffBestMatchForObject<Item, Union, TotalUnion> =
  FindBestKeyForMatching<TotalUnion> extends infer K
    ? IsNever<K> extends false
      ? K extends keyof Union & keyof Item
        ? Extract<Union, { [P in K]: Item[P] }> extends infer BestMatch
          ? IsNever<BestMatch> extends false
            ? Expand<{ [P in K]: Item[P] } & Divergence<Item, BestMatch>>
            : never
          : never
        : never
      : never
    : never;

type DiffBestMatch<Item, Union, TotalUnion> = PopUnion<
  Item extends object
    ? DiffBestMatchForObject<
        Item,
        Extract<Union, object>,
        Extract<TotalUnion, object>
      >
    : never
>;

type PerfectMatch<Item, Union, TotalUnion> = Union extends [infer F, ...infer R]
  ? Divergence<Item, F> extends infer D
    ? IsNever<D> extends true
      ? F
      : PerfectMatch<Item, R, TotalUnion>
    : "!![PerfectMatch] Could not infer D"
  : never; // end of recursion

type GetChange<Item, Union, TotalUnion> = PerfectMatch<
  Item,
  UnionToArray<Union>,
  TotalUnion
> extends infer P
  ? IsNever<P> extends false
    ? never
    : DiffBestMatch<Item, Union, TotalUnion> extends infer D
      ? IsNever<D> extends false
        ? { "~": D }
        : { "+": Item }
      : "!![GetChange] Could not infer D"
  : "!![GetChange] Could not infer P";

type ArrayUnionDivergence<From, To, AllTo> = From extends [
  infer F,
  ...infer Rest,
]
  ? GetChange<F, To, AllTo> | ArrayUnionDivergence<Rest, To, AllTo>
  : never;

type ZipUnion<Union> = {
  [K in Union extends infer U ? keyof U : never]: Union extends infer U
    ? unknown extends U[K]
      ? never
      : U[K]
    : never;
};

type UnionDivergence<From, To> = ZipUnion<
  ArrayUnionDivergence<UnionToArray<From>, To, To>
> extends infer Result
  ? {} extends Result
    ? never
    : Result
  : never;

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

type ArrayDivergence<From, To> = From extends Array<infer F>
  ? To extends Array<infer T>
    ? Expand<Divergence<F, T>> extends infer D
      ? IsNever<D> extends true
        ? never
        : { [key: number]: Expand<Divergence<F, T>> }
      : never
    : ["[]?", Expand<Divergence<F, To>>]
  : To extends Array<infer T>
    ? ["[]!", Expand<Divergence<From, T>>]
    : never;

// DIVERGENCE
export type Divergence<From, To> = [IsNever<From>, IsNever<To>] extends [
  false,
  false,
]
  ? AtLeastOneArray<From, To> extends true
    ? ArrayDivergence<From, To>
    : [IsIndexedType<From>, IsIndexedType<To>] extends [true, true]
      ? IndexedTypeDiff<From, To>
      : IsAtLeastOneUnion<From, To> extends true
        ? UnionDivergence<From, To>
        : AtLeastOneEmptyObject<From, To> extends true
          ? EmptyObjectDivergence<From, To>
          : [From, To] extends [object, object]
            ? ObjectDivergence<From, To>
            : SimpleDivergence<From, To>
  : {};
