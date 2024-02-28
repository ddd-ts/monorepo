import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { Dict } from "./dict";
import { Literal } from "./literal";

describe("Definition: Literal", () => {
	it("uses keyword notation", () => {
		class Test extends ObjectShape(
			Dict({
				string: Literal(String),
				number: Literal(Number),
				date: Literal(Date),
			}),
		) {}

		// @ts-expect-error - missing value
		new Test({ string: "1", number: 1 });
		new Test({
			// @ts-expect-error - wrong type
			string: 1,
			// @ts-expect-error - wrong type
			number: "1",
			// @ts-expect-error - wrong type
			date: "1",
		});

		const test = new Test({ string: "a", number: 1, date: new Date() });

		expect(test.string).toBe("a");
		expect(test.number).toBe(1);
		expect(test.date).toBeInstanceOf(Date);

		check(Test, test);
	});

	it("uses keyword-less notation", () => {
		class Test extends ObjectShape({
			string: String,
			number: Number,
			date: Date,
		}) {}

		// @ts-expect-error - missing value
		new Test({});
		// @ts-expect-error - wrong type
		new Test({ value: 1 });

		const test = new Test({ string: "a", number: 1, date: new Date() });

		expect(test.string).toBe("a");
		expect(test.number).toBe(1);
		expect(test.date).toBeInstanceOf(Date);

		check(Test, test);
	});
});
