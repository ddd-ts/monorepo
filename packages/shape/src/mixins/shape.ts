import {
	DictConfiguration,
	DictDefinition,
	DictShorthand,
} from "../definitions/dict";
import {
	AnyDefinition,
	ShorthandToLonghand,
	AnyShorthand,
} from "../definitions/shorthands";
import { shorthandToLonghand } from "../shorthandToLonghand";
import { Class } from "../types";
import { Primitive } from "./primitive";
import { ObjectShape } from "./objectShape";

class Base {}

export const Shape = <
	const D extends AnyShorthand | AnyDefinition,
	const B extends Class<{}>,
>(
	definition: D,
	base: B = Base as B,
): D extends DictConfiguration | DictDefinition
	? ReturnType<typeof ObjectShape<D, B>>
	: ReturnType<typeof Primitive<ShorthandToLonghand<D>, B>> => {
	const longhand = shorthandToLonghand(definition);
	if (!longhand.isDict) {
		return Primitive(definition, base) as any;
	}
	return ObjectShape(definition as DictDefinition, base) as any;
};
