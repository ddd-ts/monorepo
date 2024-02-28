import { IsShapeConstructor } from "../mixins/objectShape";
import { Definition } from "./definition";

export type ChildConfiguration = IsShapeConstructor<Definition>;
export type ChildShorthand = ChildConfiguration;
export type ChildDefinition<C extends ChildConfiguration = ChildConfiguration> =
	Definition<
		InstanceType<C>,
		InstanceType<C> extends { serialize(): infer D } ? D : never
	>;
export function Child<C extends ChildConfiguration>(
	configuration: C,
): ChildDefinition<C> {
	return {
		paramToRuntime: (param) => param,
		serialize: (runtime) => {
			return runtime.serialize();
		},
		deserialize: (serialized) => {
			return configuration.deserialize(serialized);
		},
	};
}
