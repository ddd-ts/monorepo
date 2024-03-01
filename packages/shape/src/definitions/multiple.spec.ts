import { Shape } from "..";
import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { Literal } from "./literal";
import { Multiple } from "./multiple";

describe("Definition: Multiple", () => {
	it("uses keyword notation", () => {
		class Test extends ObjectShape({
			value: Multiple(Literal(String)),
		}) {}

		const a = new Test({
			value: ["a", "b", "c"],
		});

		expect(a.value).toEqual(["a", "b", "c"]);
		check(Test, a);
	});

	it("uses keyword-less notation", () => {
		class Test extends ObjectShape({
			value: [String],
		}) {}

		const a = new Test({ value: ["a", "b", "c"] });

		expect(a.value).toEqual(["a", "b", "c"]);
		check(Test, a);
	});

	it('works with objects', () => {

		class Id extends Shape(String){}

		class Test extends Shape({
			mult: [{ id: Id }]
		}){}

		const a = new Test({ mult: [{ id: new Id('1') }, { id: new Id('2') }] });
		a.serialize()
		class DaxiumLink extends Shape({
			id: Id,
			endpointId: Id,
			forms: [{ id: Id, templates: [Id] }],
		}) {}

	});
});
