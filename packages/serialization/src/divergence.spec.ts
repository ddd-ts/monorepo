import { Divergence } from "./divergence";

{
  // it should return never when left and right are the same
  const a: never = {} as Divergence<string, string>;
  const b: never = {} as Divergence<number, number>;
  const c: never = {} as Divergence<{}, {}>;
  const d: never = {} as Divergence<[], []>;
  const e: never = {} as Divergence<true, true>;
  const f: never = {} as Divergence<string | number, number | string>;

  type ga = { a: string | number } | { b: string };
  type gb = { a: number | string } | { b: string };
  const g: never = {} as Divergence<ga, gb>;
}

{
  // it should detect top level differences
  type L = string;
  type R = number;
  type D = Divergence<L, R>;

  const error: D = ["", "!=", 0];
}

{
  // it should detect shallow differences
  type L = { a: string };
  type R = { a: number };
  type D = Divergence<L, R>;

  const error: D = {
    a: ["", "!=", 0],
  };
}

{
  // it should detect deep differences
  type L = { a: string; b: { c: number } };
  type R = { a: string; b: { c: string } };
  type D = Divergence<L, R>;

  const error: D = {
    b: {
      c: [0, "!=", ""],
    },
  };
}

{
  // it should detect when left is an object but right isnt
  type L = { a: {} };
  type R = { a: string };
  type D = Divergence<L, R>;

  const error: D = {
    a: [{}, "!=", ""],
  };
}

{
  // it should detect when right is an object but left isnt
  type L = { a: string };
  type R = { a: { a: true } };
  type D = Divergence<L, R>;

  const error: D = {
    a: ["", "!=", { a: true }],
  };
}

{
  // it should detect missing properties
  type L = { a: string; b: { c: number } };
  type R = { a: string; b: { c: number; d: string } };
  type D = Divergence<L, R>;

  const error: D = {
    b: {
      "-d": "",
    },
  };
}

{
  // it should detect multiple differences
  type L = { a: string; b: { c: number } };
  type R = { a: number; b: { c: string } };
  type D = Divergence<L, R>;

  const error: D = {
    a: ["", "!=", 0],
    b: {
      c: [0, "!=", ""],
    },
  };
}

{
  // it should not detect unions with compatible types
  type L = { type: "room"; thing: true } | { type: "folder"; other: true };
  type R =
    | { type: "room"; thing: true }
    | { type: "folder"; other: true | false };

  type D = Divergence<L, R>;
  const a: D = undefined as never;
}

{
  // it should detect deep unions with uncompatible types
  type L = { a: { b: { c: { d: number } | { e: string } } } };
  type R = { a: { b: { c: { d: number } | { e: number } } } };
  type D = Divergence<L, R>;

  const error: D = {
    a: {
      b: {
        c: {
          "+": { e: "" },
        },
      },
    },
  };
}

{
  type L = { a: { b: { c: { d: number | string } } } };
  type R = { a: { b: { c: { d: number } } } };
  type D = Divergence<L, R>;

  const error: D = {
    a: {
      b: {
        c: {
          d: {
            "+": "",
          },
        },
      },
    },
  };
}

{
  // it should detect diffs in unions

  type L = { type: "a"; a: string } | { type: "b"; b: number };
  type R = { type: "a"; a: string } | { type: "b"; b: string };

  type D = Divergence<L, R>;

  const error: D = {
    "~": {
      type: "b",
      b: [0, "!=", ""],
    },
  };
}

it("this is a type test file", () => {
  expect(true).toBe(true);
});
