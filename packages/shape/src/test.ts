import { Constructor, Expand } from "./_";

type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T
  ? 1
  : 2) extends <G>() => G extends U ? 1 : 2
  ? Y
  : N;

export type Equals<X, Y> = IfEquals<X, Y, true, false>;

type tests = {
  // Booleans
  "Equals<true, true> -> true": [Equals<true, true>, true];
  "Equals<true, false> -> false": [Equals<true, false>, false];
  "Equals<false, true> -> false": [Equals<false, true>, false];
  "Equals<false, false> -> true": [Equals<false, false>, true];
  "Equals<true, any> -> false": [Equals<true, any>, false];
  "Equals<any, true> -> false": [Equals<any, true>, false];
  "Equals<false, any> -> false": [Equals<false, any>, false];
  "Equals<any, false> -> false": [Equals<any, false>, false];
  "Equals<true, unknown> -> false": [Equals<true, unknown>, false];
  "Equals<unknown, true> -> false": [Equals<unknown, true>, false];
  "Equals<false, unknown> -> false": [Equals<false, unknown>, false];
  "Equals<unknown, false> -> false": [Equals<unknown, false>, false];
  "Equals<true, never> -> false": [Equals<true, never>, false];
  "Equals<never, true> -> false": [Equals<never, true>, false];
  "Equals<false, never> -> false": [Equals<false, never>, false];
  "Equals<never, false> -> false": [Equals<never, false>, false];
  "Equals<true, true | false> -> true": [Equals<true, true | false>, false];
  "Equals<true | false, true> -> true": [Equals<true | false, true>, false];

  // Numbers
  "Equals<1, 1> -> true": [Equals<1, 1>, true];
  "Equals<1, 2> -> false": [Equals<1, 2>, false];
  "Equals<2, 1> -> false": [Equals<2, 1>, false];
  "Equals<2, 2> -> true": [Equals<2, 2>, true];
  // Strings
  "Equals<'a', 'a'> -> true": [Equals<"a", "a">, true];
  "Equals<'a', 'b'> -> false": [Equals<"a", "b">, false];
  "Equals<'b', 'a'> -> false": [Equals<"b", "a">, false];
  "Equals<'b', 'b'> -> true": [Equals<"b", "b">, true];
  // Arrays
  "Equals<[], []> -> true": [Equals<[], []>, true];
  "Equals<[], [1]> -> false": [Equals<[], [1]>, false];
  "Equals<[1], []> -> false": [Equals<[1], []>, false];
  "Equals<[1], [1]> -> true": [Equals<[1], [1]>, true];
  // Objects

  "Equals<{}, {}> -> true": [Equals<{}, {}>, true];
  "Equals<{}, { a: 1 }> -> false": [Equals<{}, { a: 1 }>, false];
  "Equals<{ a: 1 }, {}> -> false": [Equals<{ a: 1 }, {}>, false];
  "Equals<{ a: 1 }, { a: 1 }> -> true": [Equals<{ a: 1 }, { a: 1 }>, true];
  "Equals<{ a: 1 }, { a: 2 }> -> false": [Equals<{ a: 1 }, { a: 2 }>, false];
  "Equals<{ a: 2 }, { a: 1 }> -> false": [Equals<{ a: 2 }, { a: 1 }>, false];
  "Equals<{ a: 2 }, { a: 2 }> -> true": [Equals<{ a: 2 }, { a: 2 }>, true];
  "Equals<{ a: 1 }, { b: 1 }> -> false": [Equals<{ a: 1 }, { b: 1 }>, false];
  "Equals<{ b: 1 }, { a: 1 }> -> false": [Equals<{ b: 1 }, { a: 1 }>, false];
  // Objects with any, unknown, never
  "Equals<{}, any> -> false": [Equals<{}, any>, false];
  "Equals<any, {}> -> false": [Equals<any, {}>, false];
  "Equals<{}, unknown> -> false": [Equals<{}, unknown>, false];
  "Equals<unknown, {}> -> false": [Equals<unknown, {}>, false];
  "Equals<{}, never> -> false": [Equals<{}, never>, false];
  "Equals<never, {}> -> false": [Equals<never, {}>, false];
  // Objects with nested any, unknown, never and real types
  "Equals<{ a: any }, { a: any }> -> true": [
    Equals<{ a: any }, { a: any }>,
    true,
  ];
  "Equals<{ a: unknown }, { a: unknown }> -> true": [
    Equals<{ a: unknown }, { a: unknown }>,
    true,
  ];
  "Equals<{ a: never }, { a: never }> -> true": [
    Equals<{ a: never }, { a: never }>,
    true,
  ];
  "Equals<{ a: any }, { a: unknown }> -> false": [
    Equals<{ a: any }, { a: unknown }>,
    false,
  ];
  "Equals<{ a: any }, { a: never }> -> false": [
    Equals<{ a: any }, { a: never }>,
    false,
  ];
  "Equals<{ a: unknown }, { a: any }> -> false": [
    Equals<{ a: unknown }, { a: any }>,
    false,
  ];
  "Equals<{ a: unknown }, { a: never }> -> false": [
    Equals<{ a: unknown }, { a: never }>,
    false,
  ];
  "Equals<{ a: never }, { a: any }> -> false": [
    Equals<{ a: never }, { a: any }>,
    false,
  ];
  "Equals<{ a: never }, { a: unknown }> -> false": [
    Equals<{ a: never }, { a: unknown }>,
    false,
  ];
  "Equals<{ a: any }, { a: 1 }> -> false": [
    Equals<{ a: any }, { a: 1 }>,
    false,
  ];
  "Equals<{ a: unknown }, { a: 1 }> -> false": [
    Equals<{ a: unknown }, { a: 1 }>,
    false,
  ];
  "Equals<{ a: never }, { a: 1 }> -> false": [
    Equals<{ a: never }, { a: 1 }>,
    false,
  ];
  "Equals<{ a: 1 }, { a: any }> -> false": [
    Equals<{ a: 1 }, { a: any }>,
    false,
  ];
  "Equals<{ a: 1 }, { a: unknown }> -> false": [
    Equals<{ a: 1 }, { a: unknown }>,
    false,
  ];
  "Equals<{ a: 1 }, { a: never }> -> false": [
    Equals<{ a: 1 }, { a: never }>,
    false,
  ];
  "Equals<{ (): string } & { (x: string): number },{ (x: string): number } & { (): string }>": [
    Equals<
      { (): string } & { (x: string): number },
      { (x: string): number } & { (): string }
    >,
    false,
  ];
};

type check = {
  [name in keyof tests]: Equals<tests[name][0], tests[name][1]> extends true
  ? true
  : false;
};

type failingtests = {
  [name in keyof check]: check[name] extends true ? never : name;
}[keyof check];

const popStackTrace = (error: any) => {
  const lines = error.stack.split("\n") as string[];
  const at = lines.findIndex((line) => line.includes("at"));
  lines.splice(at, 1);
  error.stack = lines.join("\n");
  return error;
};

export function ex<Received>(received: Received) {
  return {
    toBe<Expected>(
      expected: Expected,
    ): Equals<Received, Expected> extends true
      ? { ok: true }
      : { expected: Expected; received: Received } {
      try {
        expect(received).toBe(expected);
      } catch (error) {
        throw popStackTrace(error);
      }
      return { ok: true } as any;
    },
    toStrictEqual<Expected>(
      expected: Expected,
    ): Equals<Received, Expected> extends true
      ? { ok: true }
      : { expected: Expected; received: Received } {
      try {
        expect(received).toStrictEqual(expected);
      } catch (error) {
        throw popStackTrace(error);
      }
      return { ok: true } as any;
    },
    toBeInstanceOf<Expected extends Constructor>(
      expected: Expected,
    ): Equals<Received, InstanceType<Expected>> extends true
      ? { ok: true }
      : { expected: InstanceType<Expected>; received: Received } {
      try {
        expect(received).toBeInstanceOf(expected);
      } catch (error) {
        throw popStackTrace(error);
      }
      return { ok: true } as any;
    },
    toHaveFirstParam<Expected>(): Received extends (
      first: infer P,
      ...rest: any[]
    ) => any
      ? Equals<P, Expected> extends true
      ? { ok: true }
      : { expected: Expected; received: P }
      : Received extends Constructor<any, [infer P, ...any[]]>
      ? Equals<P, Expected> extends true
      ? { ok: true }
      : { expected: Expected; received: P }
      : "not a function or constructor" {
      return { ok: true } as any;
    },
  };
}
