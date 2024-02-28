import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { Tuple } from "./tuple";

describe("Definition: Tuple", () => {
	it("keyword notation", () => {
		class Test extends ObjectShape({
			tuple: Tuple(Number, String),
		}) {}

		const a = new Test({
			tuple: [1, "a"],
		});

		check(Test, a);
	});
});
