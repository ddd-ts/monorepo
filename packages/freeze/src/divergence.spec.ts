import { Divergence, type UnionDivergence } from "./divergence";

type Equals<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

{
  // it should return never when left and right are the same
  const a: never = {} as Divergence<string, string>;
  const b: never = {} as Divergence<number, number>;
  const c: never = {} as Divergence<{}, {}>;
  // const d: never = {} as Divergence<[], []>;
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
  type R = { type: "a"; a: string } | { type: "b"; b: string } | undefined;

  type D = Divergence<L, R>;

  type expected = {
    "~": {
      type: "b";
      b: [number, "!=", string];
    };
  };

  const check: Equals<D, expected> = true;
}

{
  type L = {
    a: {
      b: {
        c: { type: "a"; a: string } | { type: "b"; b: number };
      }[];
    };
  };

  type R = {
    a: {
      b: {
        c: { type: "a"; a: string } | { type: "b"; b: string };
      }[];
    };
  };

  type D = Divergence<L, R>;

  type check = D;

  const error: D = {
    a: {
      b: [
        {
          c: {
            "~": { b: [0, "!=", ""], type: "b" },
          },
        },
      ],
    },
  };
}

{
  type Rec<T> = { next: Rec<T>; value: T };

  type R = Rec<number>;
  type L = Rec<string>;

  type D = Divergence<L, R>;

  type expected = { value: [string, "!=", number] };

  const check: Equals<D, expected> = true;
}

{
  type Option<T> = { type: T; a: T };
  type Options =
    | Option<string>
    | Option<number>
    | Option<boolean>
    | Option<null>
    | Option<{
        a: string;
        b: number;
      }>;

  type Rec<T> = { next: Rec<T>; value: T };

  type L = {
    id: string;
    options: Rec<Options>;
  };

  type R = {
    id: string;
    options: Options;
  };

  type D = Divergence<L["options"], R["options"]>;

  type expected = {
    "+": Rec<Options>;
  };

  const check: Equals<D, expected> = true;
}

{
  type Recursive = {
    name: string;
    children: undefined | Recursive[];
  };

  type L = {
    a: Recursive[];
  };

  type R = {
    a: Recursive[];
    b: true;
  };

  // type Narrow<T extends A | B> = T;

  // type L = Narrow<B>;
  // type R = Narrow<A>;

  type D = Divergence<L, R>;

  type expected = never;

  const check: Equals<D, expected> = {} as never;
}

{
  // should not infinite recurse when no best key on union

  type L = { type: string; e: boolean };
  type R = { type: "a"; e: boolean } | { type: "b"; e: boolean };

  type D = Divergence<L, R>;

  type expected = { "+": L };
  const check: Equals<D, expected> = true;
}

{
  // should work with optional properties

  type L = { a?: { value: 1 } | { value: 2 } };
  type R = { a: { value: 1 } | { value: 3 } };

  type D = Divergence<L, R>;

  type expected = {
    a: {
      "+":
        | {
            value: 2;
          }
        | undefined;
    };
  };
  const check: Equals<D, expected> = true;
}

{
  type L =
    | undefined
    | ({ type: "a"; value: 1 } | { type: "b"; value: 2 } | { type: "c" })[]
    | ({ type: "d" } | { type: "e"; value: 4 })[];

  type R =
    | undefined
    | ({ type: "a"; value: 1 } | { type: "b"; value: 3 } | { type: "c" })[]
    | ({ type: "d" } | { type: "e" })[];

  type D = UnionDivergence<L, R, []>;

  type expected = {
    "~":
      | {
          [key: number]: {
            "~": {
              type: "b";
              value: [2, "!=", 3];
            };
          };
        }
      | {
          [key: number]: {
            "~": {
              type: "e";
              "+value": 4;
            };
          };
        };
  };

  const check: Equals<D, expected> = true;
}

{
  type L = string[];
  type R = string[] | undefined;
  type expected = never;
  type D = Divergence<L, R>;

  const check: Equals<D, expected> = true;
}

it("this is a type test file", () => {
  expect(true).toBe(true);
});
