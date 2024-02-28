import {
	Definition,
	DefinitionParameter,
	DefinitionRuntime,
	DefinitionSerialized,
} from "../definitions/definition";
import { NothingDefinition } from "../definitions/nothing";
import {
	ShorthandToLonghand,
	AnyShorthand,
	AnyDefinition,
} from "../definitions/shorthands";
import { shorthandToLonghand } from "../shorthandToLonghand";
import { Class, Constructor, Expand } from "../types";

export type IsPrimitiveConstructor<D extends AnyShorthand | AnyDefinition> =
	Constructor<{
		serialize: () => Expand<DefinitionSerialized<ShorthandToLonghand<D>>>;
	}> & {
		deserialize: ShorthandToLonghand<D>["deserialize"];
		isPrimitive: true;
	};

class DefaultPrimitiveBaseClass {}

export const Primitive = <
	const D extends AnyShorthand | Definition,
	B extends Class<{}>,
>(
	definition: D,
	base: B = DefaultPrimitiveBaseClass as B,
) => {
	const longhand = shorthandToLonghand(definition);

	class Intermediate extends base {
		static isPrimitive = true as const;
		public value: DefinitionRuntime<ShorthandToLonghand<D>>;

		constructor(...args: any[]) {
			const converted = longhand.paramToRuntime(args[0]);
			super();
			this.value = converted;
		}

		static deserialize<T extends IsPrimitiveConstructor<D>>(
			this: T,
			serialized: Expand<DefinitionSerialized<ShorthandToLonghand<D>>>,
		) {
			return new this(longhand.deserialize(serialized as any)) as any;
		}

		serialize(): Expand<DefinitionSerialized<ShorthandToLonghand<D>>> {
			return longhand.serialize(this.value) as any;
		}
	}

	type Params = ShorthandToLonghand<D> extends NothingDefinition
		? []
		: [data: Expand<DefinitionParameter<ShorthandToLonghand<D>>>];

	return Intermediate as unknown as {
		isPrimitive: true;
		new (...args: Params): {
			serialize(): Expand<DefinitionSerialized<ShorthandToLonghand<D>>>;
		} & Intermediate &
			InstanceType<B>;
		deserialize<T extends Class<{}>>(
			this: T,
			serialized: Expand<DefinitionSerialized<ShorthandToLonghand<D>>>,
		): InstanceType<T>;
	} & Omit<B, "">;
};
