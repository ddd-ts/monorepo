import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { Either } from "./either";

describe("Definition: Either", () => {
	it("uses keyword notation", () => {
		class A extends ObjectShape({
			value: String,
		}) {}

		class B extends ObjectShape({
			value: Number,
		}) {}

		class Test extends ObjectShape({
			value: Either(A, B),
		}) {}

		const a = new Test({ value: new A({ value: "a" }) });
		expect(a.value.value).toEqual("a");
		check(Test, a);

		const b = new Test({ value: new B({ value: 1 }) });
		expect(b.value.value).toEqual(1);
	});
});
