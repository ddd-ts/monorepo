type PathUptoFirstSerialize<T> = T extends { serialize(...args: any[]): any }
  ? []
  : T extends Record<string, unknown>
    ? { [K in keyof T]: [K, ...PathUptoFirstSerialize<T[K]>] }[keyof T]
    : T extends any[]
      ? { [K in keyof T]: [K, ...PathUptoFirstSerialize<T[K]>] }[number]
      : T extends readonly any[]
        ? { [K in keyof T]: [K, ...PathUptoFirstSerialize<T[K]>] }[number]
        : never;

type JoinWithDot<T extends readonly unknown[] | undefined> =
  T extends readonly [infer H, ...infer R]
    ? H extends string
      ? R extends readonly string[]
        ? R["length"] extends 0
          ? H
          : `${H}.${JoinWithDot<R>}`
        : H
      : never
    : never;

type NoUnserialized<T extends object> = {
  [K in keyof T as PathUptoFirstSerialize<T[K]> extends never
    ? never
    : K]: PathUptoFirstSerialize<T[K]> extends []
    ? K & string
    : JoinWithDot<PathUptoFirstSerialize<T[K]>>;
};

type Pretty<T> = { [K in keyof T]: T[K] } & {};

export const noUnserialized = <T extends object>(
  obj: {} extends NoUnserialized<T>
    ? T
    : {
        error: "Object has unserialized properties";
        details: Pretty<NoUnserialized<T>>;
      },
): T => {
  return obj as T;
};
