import * as ts from "typescript";
import { exploreType } from "./utils/explore-type";
import assert from "node:assert";

function findCalls(source: ts.Node): ts.CallExpression[] {
  const children = source.getChildren();
  const innerCalls = children.flatMap((c) => findCalls(c));
  if (ts.isCallExpression(source)) {
    innerCalls.push(source);
  }
  return innerCalls;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function testFreeze(id: string, value: any) {
  const file = __filename;

  const program = ts.createProgram([file], { strictNullChecks: true });
  const checker = program.getTypeChecker();

  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const sourceFile = program
    .getSourceFiles()
    .find((s) => s.fileName.includes(file))!;

  const test = findCalls(sourceFile).find((c) =>
    c.getText().startsWith("testFreeze") &&
    c.arguments[0].getText().includes(id),
  );
  assert.ok(test, `Could not find testFreeze call with id ${id}`);
  const toFreeze = test.arguments[1];

  const type = checker.getTypeAtLocation(toFreeze);

  // Explore the type definition
  const other = new Map();
  const explored = exploreType(type, checker, other);
  const typeDefinitions = [...other.values()].join("\n");
  return `${typeDefinitions}\ntype Output = ${explored};`;
}

describe("freeze", () => {
  it("should freeze a value", () => {
    const result = testFreeze("1", { a: 1, b: new Date() });

    expect(result).toEqual("\ntype Output = { a: number; b: Date; };");
  });

  it("should freeze a value with a nested object", () => {
    type Thing = { a: number; b: { c: number } };

    const result = testFreeze("2", {} as Thing);

    expect(result).toEqual(
      [
        "type Thing = { a: number; b: { c: number; }; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should freeze a value with a nested array", () => {
    type Thing = { a: number; b: number[] };

    const result = testFreeze("3", {} as Thing);

    expect(result).toEqual(
      [
        "type Thing = { a: number; b: (number)[]; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should freeze a value referencing another one", () => {
    type Thing = { a: string };
    type OtherThing = { b: Thing };

    const result = testFreeze("4", {} as OtherThing);

    expect(result).toEqual(
      [
        "type Thing = { a: string; }",
        "type OtherThing = { b: Thing; }",
        "type Output = OtherThing;",
      ].join("\n"),
    );
  });

  it("should freeze a value referencing another one 2", () => {
    type Thing = { a: Thing };
    const result = testFreeze("41", {} as Thing);

    expect(result).toEqual(
      ["type Thing = { a: Thing; }", "type Output = Thing;"].join("\n"),
    );
  });

  it("should freeze a cross-recursive value", () => {
    type Thing = { a: number; b: OtherThing };
    type OtherThing = { c: Thing };

    const result = testFreeze("5", {} as OtherThing);

    expect(result).toEqual(
      [
        "type Thing = { a: number; b: OtherThing; }",
        "type OtherThing = { c: Thing; }",
        "type Output = OtherThing;",
      ].join("\n"),
    );
  });

  it("should freeze a value with a nested union", () => {
    type Thing = { a: number; b: string | number; c: (string | number)[] };

    const result = testFreeze("6", {} as Thing);

    expect(result).toEqual(
      [
        "type Thing = { a: number; b: string | number; c: (string | number)[]; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should freeze a value with a nested intersection", () => {
    type Thing = { a: number; b: { a: "1" } & { b: "2" } };

    const result = testFreeze("7", {} as Thing);

    expect(result).toEqual(
      [
        `type Thing = { a: number; b: { a: "1"; } & { b: "2"; }; }`,
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should freeze a readonly array", () => {
    type Thing = { a: number; b: readonly number[] };

    const result = testFreeze("9", {} as Thing);

    expect(result).toEqual(
      [
        "type Thing = { a: number; b: readonly (number)[]; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should freeze a readonly object", () => {
    type Thing = {
      readonly a: number;
      readonly b: readonly { readonly c: number }[];
    };

    const result = testFreeze("10", {} as Thing);

    expect(result).toEqual(
      [
        "type Thing = { readonly a: number; readonly b: readonly ({ readonly c: number; })[]; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it.skip("should freeze a value with a nested tuple", () => {
    type Thing = {
      a: number;
      b: [number, number];
      c: readonly [number, number];
    };

    const result = testFreeze("8", {} as Thing);

    expect(result).toEqual(
      [
        "type Thing = { a: number; b: [number, number]; c: readonly [number, number]; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should support indexed object types", () => {
    type Thing = { [key: string]: number; test: number };
    const result = testFreeze("11", {} as Thing);
    expect(result).toEqual(
      [
        "type Thing = { [key: string]: number; test: number; }",
        "type Output = Thing;",
      ].join("\n"),
    );
  });

  it("should support records", () => {
    type Thing = Record<string, number>;
    const result = testFreeze("12", {} as Thing);
    expect(result).toEqual(
      ["", "type Output = Record<string, number>;"].join("\n"),
    );
  });

  it("should coalesce enum members to their value", () => {
    enum Thing {
      A = "0",
      B = 1,
      C = 2,
    }
    const resultA = testFreeze("13", Thing.A);
    expect(resultA).toEqual(["", 'type Output = "0";'].join("\n"));

    const resultB = testFreeze("14", Thing.B);
    expect(resultB).toEqual(["", "type Output = 1;"].join("\n"));
  });

  // it("should freeze a value referencing a generic", () => {
  // 	const thing = (a: number) => ({ a });
  // 	type OtherThing = { b: ReturnType<typeof thing> };

  // 	const result = testFreeze("13", {} as OtherThing);

  // 	expect(result).toEqual(
  // 		["type Thing<T> = { a: T; }", "type Output = Thing<number>;"].join("\n"),
  // 	);
  // });

  it("should freeze string literal types", () => {
    const result = testFreeze("15", {} as "a" | undefined);
    expect(result).toEqual(["", 'type Output = undefined | "a";'].join("\n"));
  });

  it.skip("should freeze a generic", () => {
    type Thing<T> = { a: T };

    const result = testFreeze("16", {} as Thing<number>);

    expect(result).toEqual(
      ["type Thing<T> = { a: T; }", "type Output = Thing<number>;"].join("\n"),
    );
  });
});
