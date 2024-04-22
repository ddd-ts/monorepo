type Path<
  Current extends string,
  T extends string | number | symbol,
> = Current extends ""
  ? T extends string | number
    ? `${T}`
    : "some symbol"
  : `${Current}.${T extends string | number ? T : "some symbol"}`;

type Difference = { path: string };
type ShouldHandleUnion<L, R> = IsUnion<L> | IsUnion<R>;

type Expand<T> = {
  [K in keyof T]: T[K];
} & {};

type HandleUnion<
  L,
  R,
  Current extends string,
  Diffs extends Difference[],
  I18n extends i18n,
> = IsUnion<L> extends true
  ? IsUnion<R> extends true
    ? [
        ...{
          [K in keyof UnionToArray<L>]: K extends `${number}`
            ? UnionToArray<L>[K] extends infer UnionElement
              ? UnionElement extends R
                ? Diffs
                : [
                    ...Diffs,
                    Expand<
                      {
                        path: Current;
                        message: `element of ${I18n["left"]} union not found in ${I18n["right"]} union`;
                      } & {
                        [I in I18n["left"]]: UnionElement;
                      } & {
                        [I in I18n["right"]]: Expand<R>;
                      }
                    >,
                  ]
              : Diffs
            : Diffs;
        }[keyof UnionToArray<L>],
        ...{
          [K in keyof UnionToArray<R>]: K extends `${number}`
            ? UnionToArray<R>[K] extends infer UnionElement
              ? UnionElement extends L
                ? Diffs
                : [
                    ...Diffs,
                    Expand<
                      {
                        path: Current;
                        message: `element of ${I18n["right"]} union not found in ${I18n["left"]} union`;
                      } & {
                        [I in I18n["left"]]: Expand<L>;
                      } & {
                        [I in I18n["right"]]: UnionElement;
                      }
                    >,
                  ]
              : Diffs
            : Diffs;
        }[keyof UnionToArray<R>],
      ]
    : [
        ...Diffs,
        Expand<
          {
            path: Current;
            message: `${I18n["left"]} is an union but ${I18n["right"]} isnt`;
          } & {
            [I in I18n["left"]]: L;
          } & {
            [I in I18n["right"]]: R;
          }
        >,
      ]
  : IsUnion<R> extends true
    ? [
        ...Diffs,
        Expand<
          {
            path: Current;
            message: `${I18n["right"]} is a union but ${I18n["left"]} isnt`;
          } & {
            [I in I18n["left"]]: L;
          } & {
            [I in I18n["right"]]: R;
          }
        >,
      ]
    : Diffs;

type ShouldHandleObject<L, R> = L extends object
  ? R extends object
    ? true
    : true
  : R extends object
    ? true
    : false;

type HandleObject<
  L,
  R,
  Current extends string,
  Diffs extends Difference[],
  I18n extends i18n,
> = L extends object
  ? R extends object
    ? {
        [K in keyof L | keyof R]: K extends keyof L & keyof R
          ? Diff<L[K], R[K], I18n, Path<Current, K>, Diffs>
          : K extends keyof L
            ? [
                ...Diffs,
                Expand<
                  {
                    path: Path<Current, K>;
                    message: `${I18n["right"]} does not have this key`;
                  } & {
                    [I in I18n["left"]]: L[K];
                  } & {
                    [I in I18n["right"]]: undefined;
                  }
                >,
              ]
            : K extends keyof R
              ? [
                  ...Diffs,
                  Expand<
                    {
                      path: Path<Current, K>;
                      message: `${I18n["left"]} does not have this key`;
                    } & {
                      [I in I18n["left"]]: undefined;
                    } & {
                      [I in I18n["right"]]: R[K];
                    }
                  >,
                ]
              : Diffs;
      }[keyof L | keyof R]
    : [
        ...Diffs,
        Expand<
          {
            path: Current;
            message: `${I18n["left"]} is an object but ${I18n["right"]} isnt`;
          } & {
            [K in I18n["left"]]: L;
          } & {
            [K in I18n["right"]]: R;
          }
        >,
      ]
  : R extends object
    ? [
        ...Diffs,
        Expand<
          {
            path: Current;
            message: `${I18n["right"]} is an object but ${I18n["left"]} isnt`;
          } & {
            [K in I18n["left"]]: L;
          } & {
            [K in I18n["right"]]: R;
          }
        >,
      ]
    : Diffs;

type HandlePrimitive<
  L,
  R,
  Current extends string,
  Diffs extends Difference[],
  I18n extends i18n,
> = L extends R
  ? R extends L
    ? Diffs
    : [
        ...Diffs,
        Expand<
          {
            path: Current;
            message: `${I18n["right"]} does not extends ${I18n["left"]}`;
          } & {
            [K in I18n["left"]]: L;
          } & {
            [K in I18n["right"]]: R;
          }
        >,
      ]
  : [
      ...Diffs,
      Expand<
        {
          path: Current;
          message: `${I18n["left"]} does not extends ${I18n["right"]}`;
        } & {
          [K in I18n["left"]]: L;
        } & {
          [K in I18n["right"]]: R;
        }
      >,
    ];

type Diff<
  L,
  R,
  I18n extends i18n = default18n,
  Current extends string = "",
  Diffs extends Difference[] = [],
> = ShouldHandleUnion<L, R> extends true
  ? HandleUnion<L, R, Current, Diffs, I18n>
  : ShouldHandleObject<L, R> extends true
    ? HandleObject<L, R, Current, Diffs, I18n>
    : HandlePrimitive<L, R, Current, Diffs, I18n>;

type i18n = {
  left: string;
  right: string;
};

type default18n = {
  left: "Left";
  right: "Right";
};

export type Differences<L, R, I18n extends i18n = default18n> = Equals<
  L,
  R
> extends true
  ? never
  : Diff<L, R, I18n, "", []> extends infer U
    ? U extends Array<any>
      ? U[number]
      : never
    : never;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

type UnionToOvlds<U> = UnionToIntersection<
  U extends any ? (f: U) => void : never
>;

type PopUnion<U> = UnionToOvlds<U> extends (a: infer A) => void ? A : never;

type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

type UnionToArray<T, A extends unknown[] = []> = IsUnion<T> extends true
  ? UnionToArray<Exclude<T, PopUnion<T>>, [PopUnion<T>, ...A]>
  : [T, ...A];

export type Equals<X, Y> = (() => X) extends () => Y
  ? (() => Y) extends () => X
    ? true
    : false
  : false;
