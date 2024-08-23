import type { Constructor } from "@ddd-ts/types";
import type { INamed } from "../interfaces/named";
import type { ISerializer } from "../interfaces/serializer";

type IsStringLiteral<T> = string extends T ? false : true;

type keys<T> = keyof T & string;
type values<T> = T[keyof T & string];

export class SerializerRegistry<
  R extends { [key: string]: ISerializer<any> } = {},
> {
  store = new Map<string, any>();

  add<
    Item extends Constructor & INamed,
    S extends IsStringLiteral<Item["name"]> extends true
      ? ISerializer<InstanceType<Item>>
      : never,
  >(item: Item, serializer: S) {
    this.store.set(item.name, serializer);
    return this as unknown as SerializerRegistry<
      R & { [K in Item["name"]]: S }
    >;
  }

  get<const Name extends keys<R>>(input: Name | INamed<Name>): R[Name] {
    if (typeof input === "string") {
      return this.store.get(input);
    }
    return this.store.get(input.name);
  }

  getUnsafe(input: INamed | string): values<R> | undefined {
    if (typeof input === "string") {
      return this.store.get(input);
    }
    return this.store.get(input.name);
  }

  getUnsafeOrThrow(input: INamed | string) {
    const serializer = this.getUnsafe(input);
    if (!serializer) {
      throw new Error(`Serializer for ${input} not found`);
    }
    return serializer;
  }

  serialize<const Name extends keys<R>>(
    ...params:
      | [name: Name, instance: Parameters<R[Name]["serialize"]>[0]]
      | [instance: Parameters<values<R>["serialize"]>[0] & INamed<Name>]
  ): ReturnType<R[Name]["serialize"]> {
    const serializer = this.get(params[0]);
    return serializer.serialize(params[1] || params[0]) as any;
  }

  serializeUnsafe(
    ...params: [name: string, instance: unknown] | [instance: INamed]
  ): ReturnType<values<R>["serialize"]> | undefined {
    const serializer = this.getUnsafe(params[0]);
    return serializer?.serialize(params[1] || params[0]) as any;
  }

  serializeUnsafeOrThrow(
    ...params: [name: string, instance: unknown] | [instance: INamed]
  ): ReturnType<values<R>["serialize"]> {
    const serializer = this.getUnsafeOrThrow(params[0]);
    if (params.length === 2) {
      return serializer.serialize(params[1]) as any;
    }
    return serializer.serialize(params[0]) as any;
  }

  deserialize<const Name extends keys<R>>(
    ...params:
      | [name: Name, serialized: Parameters<R[Name]["deserialize"]>[0]]
      | [serialized: Parameters<values<R>["deserialize"]>[0] & INamed<Name>]
  ): ReturnType<R[Name]["deserialize"]> {
    const serializer = this.get(params[0]);
    if (params.length === 2) {
      return serializer.deserialize(params[1]);
    }
    return serializer.deserialize(params[0]);
  }

  deserializeUnsafe(
    ...params: [name: string, serialized: unknown] | [serialized: INamed]
  ): ReturnType<values<R>["deserialize"]> | undefined {
    const serializer = this.getUnsafe(params[0]);
    if (!serializer) {
      return;
    }
    if (params.length === 2) {
      return serializer.deserialize(params[1]);
    }
    return serializer.deserialize(params[0]);
  }

  deserializeUnsafeOrThrow(
    ...params: [name: string, serialized: unknown] | [serialized: INamed]
  ): ReturnType<values<R>["deserialize"]> {
    const serializer = this.getUnsafeOrThrow(params[0]);
    if (params.length === 2) {
      return serializer.deserialize(params[1]);
    }
    return serializer.deserialize(params[0]);
  }
}

export namespace SerializerRegistry {
  export type For<T extends INamed> = Omit<
    SerializerRegistry<{
      [K in T["name"]]: ISerializer<Extract<T, { name: K }>>;
    }>,
    "add"
  >;
}
