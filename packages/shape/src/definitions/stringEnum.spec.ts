import { Shape } from "..";
import { ObjectShape } from "../mixins/objectShape";
import { Primitive } from "../mixins/primitive";
import { check } from "../testUtils";
import { StringEnum } from "./stringEnum";

describe("Definition: StringEnum", () => {
	it("uses keyword notation", () => {
		class Test extends ObjectShape({
			enum: StringEnum("A", "B"),
		}) {}

		const valid = new Test({
			enum: "A",
		});

		const result: string | number = valid.enum.match({
			A: () => "string",
			_: () => 1,
		});

		const fallbackResult: string | number = valid.enum.match({
			A: () => "string",
			B: () => 1,
		});

		const invalid = new Test({
			// @ts-expect-error - wrong type
			enum: "C",
		});

		const a = new Test({
			enum: "A",
		});

		expect(a.enum.value).toBe("A");
		check(Test, a);
	});

	it("uses keyword-less notation", () => {
		class Test extends ObjectShape({
			enum: ["A", "B"],
		}) {}

		const valid = new Test({
			enum: "A",
		});

		const result: string | number = valid.enum.match({
			A: () => "string",
			_: () => 1,
		});

		const fallbackResult: string | number = valid.enum.match({
			A: () => "string",
			B: () => 1,
		});

		const invalid = new Test({
			// @ts-expect-error - wrong type
			enum: "C",
		});

		const a = new Test({
			enum: "A",
		});

		expect(a.enum.value).toBe("A");
		check(Test, a);
	});

	it('uses direct notation', () => {
		class Test extends Primitive(['A', 'B']) {}

		expect(Test.A()).toBeInstanceOf(Test);
		expect(Test.A().serialize()).toBe('A');
		expect(Test.B()).toBeInstanceOf(Test);
		expect(Test.B().serialize()).toBe('B');

		const valid = new Test('A');

		if(valid.is('A')){
			valid.serialize()
		}

		console.log(valid)

		const matched = valid.match({
			_: () => 'fallback',
			A: () => 'A'
		});

		expect(matched).toBe('A');

		const fallback = valid.match({
			B: () => 'B',
			_: () => 'fallback'
		});

		expect(fallback).toBe('fallback');
		
		expect(Test.values).toEqual(['A', 'B']);
		expect(valid.is('A')).toBe(true);
	})
});
