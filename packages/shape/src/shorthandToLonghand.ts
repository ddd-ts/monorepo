import { Child, ChildConfiguration } from "./definitions/child";
import {
	Definition,
	DefinitionRuntime,
	DefinitionSerialized,
} from "./definitions/definition";
import { Dict, DictConfiguration } from "./definitions/dict";
import { Literal } from "./definitions/literal";
import { Multiple } from "./definitions/multiple";
import {
	SerializableClass,
	SerializableClassConfiguration,
} from "./definitions/serializableClass";
import { AnyShorthand, ShorthandToLonghand } from "./definitions/shorthands";
import { StringEnum } from "./definitions/stringEnum";
import { Tuple } from "./definitions/tuple";

export function shorthandToLonghand<D extends Definition | AnyShorthand>(
	definition: D,
): Definition<
	DefinitionRuntime<ShorthandToLonghand<D>>,
	DefinitionSerialized<ShorthandToLonghand<D>>,
	DefinitionRuntime<ShorthandToLonghand<D>>
> {
	if (
		definition &&
		"serialize" in definition &&
		"deserialize" in definition &&
		typeof definition.serialize === "function" &&
		typeof definition.deserialize === "function"
	) {
		return definition as Definition;
	}
	if (definition === String) {
		return Literal(String) as any;
	}
	if (definition === Number) {
		return Literal(Number) as any;
	}
	if (definition === Boolean) {
		return Literal(Boolean) as any;
	}
	if (definition === Date) {
		return Literal(Date) as any;
	}
	if (definition && "prototype" in definition) {
		if ("isShape" in definition.prototype) {
			return Child(definition as ChildConfiguration);
		}
		return SerializableClass(
			definition as SerializableClassConfiguration,
		) as any;
	}
	if (Array.isArray(definition)) {
		const [arrayType] = definition;
		if (!arrayType) {
			throw new Error("cannot know multiple or string enum");
		}
		if (typeof arrayType === "string") {
			if (!definition.every((e) => typeof e === "string")) {
				throw new Error("wrong string enum");
			}
			return StringEnum(...definition);
		}
		if (definition.length !== 1) {
			return Tuple(...definition) as any;
		}
		return Multiple(arrayType) as any;
	}
	if (typeof definition === "object") {
		return Dict(definition as DictConfiguration) as any;
	}
	throw new Error(`cannot identify shorthand ${JSON.stringify(definition)}`);
}
