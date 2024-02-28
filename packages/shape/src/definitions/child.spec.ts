import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { Child } from "./child";

describe("Definition: Child", () => {
	it("uses keyword notation", () => {
		class Other extends ObjectShape({
			value: String,
		}) {}

		class Test extends ObjectShape({
			value: Child(Other),
		}) {}

		const a = new Test({ value: new Other({ value: "ya" }) });
		expect(a.value.value).toEqual("ya");
		check(Test, a);
	});

	it("uses keyword-less notation", () => {
		class Other extends ObjectShape({
			value: String,
		}) {}

		class Test extends ObjectShape({
			value: Other,
		}) {}

		const a = new Test({ value: new Other({ value: "ya" }) });
		expect(a.value.value).toEqual("ya");
		check(Test, a);
	});
});
