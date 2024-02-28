import { ObjectShape } from "../mixins/objectShape";
import { check } from "../testUtils";
import { SerializableClass } from "./serializableClass";

describe("Definition: SerializableClass", () => {
	it("uses keyword notation", () => {
		class Id {
			constructor(public value: string) {}
			serialize() {
				return this.value;
			}
			static deserialize(value: string) {
				return new Id(value);
			}
		}

		class Test extends ObjectShape({
			value: SerializableClass(Id),
		}) {}

		const a = new Test({
			value: new Id("abc"),
		});

		expect(a.value).toBeInstanceOf(Id);
		expect(a.value.value).toEqual("abc");
		check(Test, a);
	});

	it("uses keyword-less notation", () => {
		class Id {
			constructor(public value: string) {}
			serialize() {
				return this.value;
			}
			static deserialize(value: string) {
				return new Id(value);
			}
		}

		class Test extends ObjectShape({
			value: Id,
		}) {}

		const a = new Test({
			value: new Id("abc"),
		});

		expect(a.value).toBeInstanceOf(Id);
		expect(a.value.value).toEqual("abc");
		check(Test, a);
	});

	it("does not allow SerializableClass with not serializable serialize() return type", () => {
		class Test {
			serialize() {
				return {
					ok: 1,
					ko: () => {},
				};
			}
			static deserialize(arg: any) {
				return new Test();
			}
		}

		// @ts-expect-error - cannot detect shorthand
		class TestShape extends ObjectShape({
			// @ts-expect-error - class is not serializable
			ko: Test,
		}) {}
	});

	it("Allows recursive serialization with SerializableClass", () => {
		class Tree {
			constructor(
				public readonly name: string,
				public readonly child: Tree | undefined,
			) {}

			serialize(): {
				name: string;
				child: ReturnType<Tree["serialize"]> | undefined;
			} {
				return {
					name: this.name,
					child: this.child?.serialize(),
				};
			}

			static deserialize(serialized: ReturnType<Tree["serialize"]>): Tree {
				return new Tree(
					serialized.name,
					serialized.child ? Tree.deserialize(serialized.child) : undefined,
				);
			}
		}

		class Test extends ObjectShape({
			root: Tree,
		}) {}

		const a = new Test({
			root: new Tree("a", new Tree("b", new Tree("c", undefined))),
		});

		expect(a.root.name).toBe("a");
		expect(a.root.child?.name).toBe("b");
		expect(a.root.child?.child?.name).toBe("c");
		expect(a.root.child?.child?.child).toBe(undefined);

		check(Test, a);
	});
});
