import { IsShapeConstructor } from "./mixins/objectShape";
import { Definition } from "./definitions/definition";
import { IsPrimitiveConstructor } from "./mixins/primitive";

export function check<D extends Definition>(
	ctor: IsShapeConstructor<D>,
	instance: InstanceType<IsShapeConstructor<D>>,
) {
	expect(instance).toEqual(ctor.deserialize(instance.serialize()));
}

export function checkPrimitive<D extends Definition>(
	ctor: IsPrimitiveConstructor<D>,
	instance: InstanceType<IsPrimitiveConstructor<D>>,
) {
	expect(instance).toEqual(ctor.deserialize(instance.serialize()));
}
