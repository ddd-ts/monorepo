import { shorthandToLonghand } from "../shorthandToLonghand";
import { Constructor } from "../types";
import { Definition } from "./definition";

type Serialization =
  | { [key: string]: Serialization }
  | string
  | number
  | boolean
  | Date
  | undefined;

export type SerializableClassConfiguration = Constructor<{
  serialize(): Serialization;
}> & {
  deserialize(serialized: Serialization): any;
};
export type SerializableClassShorthand = SerializableClassConfiguration;
export type SerializableClassDefinition<
  C extends SerializableClassConfiguration = SerializableClassConfiguration
> = Definition<InstanceType<C>, ReturnType<InstanceType<C>["serialize"]>>;
export function SerializableClass<C extends SerializableClassConfiguration>(
  configuration: C
): SerializableClassDefinition<C> {
  return {
    paramToRuntime: (param) => param,
    serialize: (runtime) => {
      return runtime.serialize() as any;
    },
    deserialize: (serialized) => {
      return configuration.deserialize(serialized) as any;
    }
  };
}
