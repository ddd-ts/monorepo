import type { Constructor } from "@ddd-ts/types";
import type { ISerializer } from "../interfaces/serializer";

export type AutoSerializable = Constructor<{ serialize(): any }> & {
  deserialize(value: any): any;
};

export const AutoSerializer = <
  T extends AutoSerializable,
  const V extends number,
>(
  of: T,
  version: V,
) => {
  type Instance = InstanceType<T>;

  return class $AutoSerializer implements ISerializer<Instance> {
    serialize(
      value: Instance,
    ): ReturnType<Instance["serialize"]> & { version: V } {
      return {
        ...value.serialize(),
        version,
      };
    }

    deserialize(serialized: ReturnType<this["serialize"]>): Instance {
      const { version, ...rest } = serialized;
      return of.deserialize(rest);
    }
  };
};
