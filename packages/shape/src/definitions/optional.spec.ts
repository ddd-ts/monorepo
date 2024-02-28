import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { Optional } from "./optional";

describe("Definition: Optional", () => {
	it("uses keyword notation", () => {
		class Test extends ObjectShape({
			value: Optional(String),
		}) {}

		const a = new Test({});
		expect(a.value).toEqual(undefined);
		check(Test, a);

		const b = new Test({ value: "a" });
		expect(b.value).toEqual("a");
		check(Test, b);
	});
});
