import { IsShapeConstructor, ObjectShape } from "./mixins/objectShape";
import { Definition } from "./definitions/definition";
import { IsPrimitiveConstructor } from "./mixins/primitive";

export function check<D extends Definition>(
	constructor: IsShapeConstructor<D>,
	instance: InstanceType<IsShapeConstructor<D>>,
) {
	expect(instance).toEqual(constructor.deserialize(instance.serialize()));
}

export function checkPrimitive<D extends Definition>(
	constructor: IsPrimitiveConstructor<D>,
	instance: InstanceType<IsPrimitiveConstructor<D>>,
) {
	expect(instance).toEqual(constructor.deserialize(instance.serialize()));
}
