import type { Differences } from "./differences";

{
  // it should return never when left and right are the same
  const a: never = {} as Differences<string, string>;
  const b: never = {} as Differences<number, number>;
  const c: never = {} as Differences<{}, {}>;
  const d: never = {} as Differences<[], []>;
  const e: never = {} as Differences<true, true>;
  const f: never = {} as Differences<string | number, number | string>;

  type ga = { a: string | number } | { b: string };
  type gb = { a: number | string } | { b: string };
  const g: never = {} as Differences<ga, gb>;
}

{
  // it should detect top level differences
  type L = string;
  type R = number;
  type D = Differences<L, R>;

  const error: D = {
    path: "",
    message: "Left does not extends Right",
    Left: "string",
    Right: 0,
  };
}

{
  // it should detect shallow differences
  type L = { a: string };
  type R = { a: number };
  type D = Differences<L, R>;

  const error: D = {
    path: "a",
    message: "Left does not extends Right",
    Left: "string",
    Right: 0,
  };
}

{
  // it should detect deep differences
  type L = { a: string; b: { c: number } };
  type R = { a: string; b: { c: string } };
  type D = Differences<L, R>;

  const error: D = {
    path: "b.c",
    message: "Left does not extends Right",
    Left: 0,
    Right: "string",
  };
}

{
  // it should detect when left is an object but right isnt
  type L = { a: {} };
  type R = { a: string };
  type D = Differences<L, R>;

  const error: D = {
    path: "a",
    message: "Left is an object but Right isnt",
    Left: {},
    Right: "string",
  };
}

{
  // it should detect when right is an object but left isnt
  type L = { a: string };
  type R = { a: {} };
  type D = Differences<L, R>;

  const error: D = {
    path: "a",
    message: "Right is an object but Left isnt",
    Left: "string",
    Right: {},
  };
}

{
  // it should detect missing properties
  type L = { a: string; b: { c: number } };
  type R = { a: string; b: { c: number; d: string } };
  type D = Differences<L, R>;

  const error: D = {
    path: "b.d",
    message: "Left does not have this key",
    Left: undefined,
    Right: "string",
  };
}

{
  // it should detect multiple differences
  type L = { a: string; b: { c: number } };
  type R = { a: number; b: { c: string } };
  type D = Differences<L, R>;

  const error1: D = {
    path: "a",
    message: "Left does not extends Right",
    Left: "string",
    Right: 0,
  };
  const error2: D = {
    path: "b.c",
    message: "Left does not extends Right",
    Left: 0,
    Right: "string",
  };
}

{
  // it should detect unions with uncompatible types
  type L = { type: "room"; thing: true } | { type: "folder"; other: true };
  type R =
    | { type: "room"; thing: true }
    | { type: "folder"; other: true | false };

  type D = Differences<L, R>;

  type expected = {
    path: "";
    message: "element of Right union not found in Left union";
    Left: { type: "room"; thing: true } | { type: "folder"; other: true };
    Right: { type: "folder"; other: true | false };
  };

  type result = Differences<expected, D> extends never
    ? true
    : Differences<expected, D>;
  const a: result = true as const;
}

{
  // it should detect deep unions with uncompatible types
  type L = { a: { b: { c: { d: number } | { e: string } } } };
  type R = { a: { b: { c: { d: number } | { e: number } } } };
  type D = Differences<L, R>;
}

{
  type L = { a: { b: { c: { d: number | string } } } };
  type R = { a: { b: { c: { d: number } } } };
  type D = Differences<L, R>;
}

it("this is a type test file", () => {
  expect(true).toBe(true);
});
