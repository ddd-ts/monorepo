import { ObjectShape } from "../mixins/objectShape";
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
});
