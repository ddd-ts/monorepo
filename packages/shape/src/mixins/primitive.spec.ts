import { Primitive } from "./primitive";
import { checkPrimitive } from "../testUtils";

describe("Primitive", () => {
	it("uses primitive", () => {
		class Id extends Primitive(String) {}

		const a = new Id("my id");
		expect(a.value).toEqual("my id");

		console.log(a.serialize());
		checkPrimitive(Id, a);
	});

	it("uses complex primitive", () => {
		class Test extends Primitive([String]) {}

		const a = new Test(["a", "b", "c"]);
		expect(a.value).toEqual(["a", "b", "c"]);

		checkPrimitive(Test, a);
	});
});
