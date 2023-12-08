import * as ts from "typescript";
import { freeze } from "./freeze.fn";

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
	return freeze(file, (source, checker) => {
		const tests = findCalls(source).filter((c) =>
			c.getText().startsWith("testFreeze"),
		);
		const test = tests.find((t) => t.arguments[0].getText().includes(id));
		if (!test) {
			throw new Error(`Could not find testFreeze call with id ${id}`);
		}

		return test.arguments[1];
	});
}

describe("freeze", () => {
	it("should freeze a value", () => {
		const result = testFreeze("1", { a: 1, b: 2 });

		expect(result).toEqual("\ntype Output = { a: number; b: number; };");
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

	it.skip("should freeze a generic", () => {
		type Thing<T> = { a: T };

		const result = testFreeze("11", {} as Thing<number>);

		expect(result).toEqual(
			["type Thing<T> = { a: T; }", "type Output = Thing<number>;"].join("\n"),
		);
	});
});
