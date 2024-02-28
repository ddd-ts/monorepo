import { ObjectShape } from "./objectShape";
import { Optional } from "../definitions/optional";
import { check } from "../testUtils";
import { DictDefinition, DictShorthand } from "../definitions/dict";
import { DefinitionParameter } from "../definitions/definition";
import { Constructor } from "../types";
import { ShorthandToLonghand } from "../definitions/shorthands";

describe("Shape", () => {
	it("uses keyword-less notation", () => {
		class ShapeChild extends ObjectShape({
			value: Number,
		}) {}

		class SerializableChild {
			constructor(public readonly value: number) {}

			serialize() {
				return { value: this.value };
			}

			static deserialize(serialized: { value: number }) {
				return new SerializableChild(serialized.value);
			}
		}

		class Test extends ObjectShape({
			string: String,
			number: Number,
			boolean: Boolean,
			date: Date,
			optional: Optional(Number),
			multiple: [Number],
			stringEnum: ["a", "b", "c"],
			child: ShapeChild,
			serializableClass: SerializableChild,
		}) {}

		const a = new Test({
			string: "my string",
			number: 2,
			boolean: true,
			date: new Date("1998-10-28T00:00:00.000Z"),
			optional: undefined,
			multiple: [1, 2, 3, 4, 5],
			stringEnum: "b",
			child: new ShapeChild({ value: 4 }),
			serializableClass: new SerializableChild(5),
		});

		expect(a.string).toEqual("my string");
		expect(a.number).toEqual(2);
		expect(a.boolean).toEqual(true);
		expect(a.date).toEqual(new Date("1998-10-28T00:00:00.000Z"));
		expect(a.optional).toEqual(undefined);
		expect(a.multiple).toEqual([1, 2, 3, 4, 5]);
		expect(a.stringEnum.value).toEqual("b");
		expect(a.child).toEqual(new ShapeChild({ value: 4 }));
		expect(a.serializableClass).toEqual(new SerializableChild(5));

		check(Test, a);
	});

	it("allows base class extension", () => {
		class Parent {
			count = 0;
			increment() {
				this.count++;
			}

			isParent = true;
			static isParent = true;
		}

		class Child extends ObjectShape({ value: Number, count: Number }, Parent) {
			isChild = true;

			dothing() {
				this.isParent;
				// @ts-expect-error
				this.notExisting;

				this.increment();
				return this.count;
			}
		}

		const child = new Child({ value: 5, count: 0 });
		expect(child.value).toBe(5);
		expect(child.isChild).toBe(true);
		expect(child.isParent).toBe(true);
		expect(child.count).toBe(0);
		child.increment();
		expect(child.count).toBe(1);
		check(Child, child);
	});

	it("allow custom base class", () => {
		const Event = <const D extends DictShorthand | DictDefinition<any>>(
			payloadDefinition: D,
		) => {
			// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
			return ObjectShape(
				{ id: String, payload: payloadDefinition },
				class I {
					static new<T extends Constructor<any>>(
						this: T,
						payload: DefinitionParameter<ShorthandToLonghand<D>>,
					) {
						return new this({ id: "123", payload }) as InstanceType<T>;
					}
				},
			);
		};

		class Deposited extends Event({ accountId: String, amount: Number }) {}

		Deposited.new({ accountId: "", amount: 4 }).serialize();
	});
});
