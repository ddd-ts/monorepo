export type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

// OBJECT
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } & {} : never;
type Access<T, K> = K extends keyof T ? T[K] : never;
type OnlyFromKeys<From, To> = Exclude<Exclude<keyof From, keyof To>, symbol>;
type OnlyToKeys<From, To> = Exclude<Exclude<keyof To, keyof From>, symbol>;
type ChangedKeys<From, To> = {
  [K in keyof From & keyof To]: Access<From, K> extends Access<To, K>
    ? never
    : K;
}[keyof From & keyof To];
type ObjectDivergence<From, To> = Expand<
  {
    [K in ChangedKeys<From, To>]: Expand<
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
  : number extends keyof T
    ? true
    : symbol extends keyof T
      ? true
      : false;

// UNION
type CountUnion<T> = UnionToArray<T> extends infer U extends any[]
  ? U["length"]
  : never;

type FindBestKeyForMatching<Union> = PopUnion<
  keyof Union extends infer K
    ? K extends keyof Union
      ? CountUnion<Pick<Union, K>[K]> extends CountUnion<Union>
        ? K
        : never
      : never
    : never
>;

type DiffBestMatchForObject<Item, Union> =
  FindBestKeyForMatching<Union> extends infer K
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

type DiffBestMatch<Item, Union> = PopUnion<
  Item extends object
    ? DiffBestMatchForObject<Item, Extract<Union, object>>
    : never
>;

type GetChange<Item, Union> = Item extends Union
  ? never
  : DiffBestMatch<Item, Union> extends infer BestMatchDiff
    ? IsNever<BestMatchDiff> extends true
      ? { "+": Item }
      : { "~": BestMatchDiff }
    : never;

type check = DiffBestMatchForObject<
  { type: "a" },
  { type: "b" } | { type: "c" }
>;

type ArrayUnionDivergence<From, To> = From extends [infer F, ...infer Rest]
  ? GetChange<F, To> | ArrayUnionDivergence<Rest, To>
  : never;

type ZipUnion<Union> = {
  [K in Union extends infer U ? keyof U : never]: Union extends infer U
    ? unknown extends U[K]
      ? never
      : U[K]
    : never;
};

type UnionDivergence<From, To> = ZipUnion<
  ArrayUnionDivergence<UnionToArray<From>, To>
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
// DIVERGENCE
export type Divergence<From, To> = [IsNever<From>, IsNever<To>] extends [
  false,
  false,
]
  ? [IsIndexedType<From>, IsIndexedType<To>] extends [true, true]
    ? IndexedTypeDiff<From, To>
    : IsAtLeastOneUnion<From, To> extends true
      ? UnionDivergence<From, To>
      : AtLeastOneEmptyObject<From, To> extends true
        ? EmptyObjectDivergence<From, To>
        : [From, To] extends [object, object]
          ? ObjectDivergence<From, To>
          : SimpleDivergence<From, To>
  : {};
