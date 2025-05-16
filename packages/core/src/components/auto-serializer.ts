import type { Constructor } from "@ddd-ts/types";
import type { ISerializer } from "../interfaces/serializer";
import { INamed } from "../interfaces/named";

export type AutoSerializable = Constructor<{ serialize(): any }> & {
  deserialize(value: any): any;
};

export type TypedAutoSerializable<T> = Constructor<T> & {
  deserialize(value: string): T;
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
    ): { version: V } & ReturnType<Instance["serialize"]> {
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

export type AutoSerializerV1<Class extends Constructor & INamed> = {
  serialize(value: InstanceType<Class>): {
    version: 1;
  } & ReturnType<InstanceType<Class>["serialize"]>;

  deserialize(
    serialized: {
      version: 1;
    } & ReturnType<InstanceType<Class>["serialize"]>,
  ): InstanceType<Class>;
};

AutoSerializer.First = <T extends AutoSerializable>(of: T) =>
  class FirstSerializer extends AutoSerializer(of, 1) {};

AutoSerializer.first = <T extends AutoSerializable & INamed>(of: T) =>
  new (class FirstSerializer extends AutoSerializer(
    of,
    1,
  ) {})() as AutoSerializerV1<T>;
