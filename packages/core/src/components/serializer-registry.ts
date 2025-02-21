import type { INamed, INamedContructor } from "../interfaces/named";
import { ISerializer, type Serialized } from "../interfaces/serializer";
import { AutoSerializable, AutoSerializer } from "./auto-serializer";

type IsStringLiteral<T> = [string] extends [T] ? false : true;

type Pretty<T> = {
  [K in keyof T]: T[K];
} & {};

export class SerializerRegistry<
  R extends [INamed, ISerializer<INamed, INamed>][] = [],
  Instances extends R[number][0] = R[number][0],
> {
  store = new Map<string, any>();

  // Ensure we can assign to a SR<[A,B]> only something that is SR<[A,B,...more]>
  // I used a function because its an contravariant position
  declare __typesafety: (params: Instances) => void;

  auto<Class extends INamedContructor & AutoSerializable>(Class: Class) {
    const first = AutoSerializer.first(Class);
    this.store.set(Class.$name, first);
    return this as unknown as SerializerRegistry<
      [...R, [InstanceType<Class>, typeof first]]
    >;
  }

  add<
    Class extends INamedContructor,
    S extends ISerializer<InstanceType<Class>, INamed<Class["$name"]>>,
  >(Class: Class, serializer: S) {
    this.store.set(Class.$name, serializer);
    return this as unknown as SerializerRegistry<
      [...R, [InstanceType<Class>, S]]
    >;
  }
  get<const I extends Instances["$name"]>(
    name: I | INamed<I>,
  ): this extends SerializerRegistry<infer RRR, any>
    ? Extract<RRR[number], [INamed<I>, any]>[1]
    : never {
    const key = typeof name === "string" ? name : name.$name;
    return this.store.get(key as any);
  }

  serialize<
    const I extends INamed,
    const TH extends SerializerRegistry<any, I>,
  >(
    this: TH,
    instance: IsStringLiteral<I["$name"]> extends true ? I : never,
  ): TH extends SerializerRegistry<infer RRR, any>
    ? Pretty<ReturnType<Extract<RRR[number], [I, any]>[1]["serialize"]>>
    : never;
  serialize<
    const I extends INamed,
    const TH extends SerializerRegistry<any, I>,
  >(
    this: TH,
    instance: I,
  ): Pretty<Serialized<ISerializer<I, INamed<I["$name"]>>>>;
  serialize(instance: INamed): unknown {
    const name = instance.$name;
    const serializer = this.store.get(name);
    if (!serializer) {
      throw new Error(`No serializer for ${name}`);
    }
    return serializer.serialize(instance);
  }

  deserialize<
    const TH extends SerializerRegistry<any, any>,
    const S extends INamed,
  >(
    this: TH,
    serialized: IsStringLiteral<S["$name"]> extends true ? S : never,
  ): TH extends SerializerRegistry<infer RRR, any>
    ? Extract<RRR[number], [INamed<S["$name"]>, any]>[0]
    : never;
  deserialize<const I extends Instances>(serialized: unknown): NoInfer<I>;
  // deserialize(serialized: unknown): unknown;
  deserialize(serialized: unknown): unknown {
    const name =
      typeof serialized === "object" &&
      serialized !== null &&
      "$name" in serialized &&
      typeof serialized.$name === "string" &&
      serialized.$name;

    if (!name) {
      throw new Error("No $name in serialized object");
    }

    const serializer = this.store.get(name);
    if (!serializer) {
      throw new Error(`No serializer for ${name}`);
    }

    return serializer.deserialize(serialized);
  }
}

export namespace SerializerRegistry {
  export type For<T extends INamed[]> = SerializerRegistry<{
    [K in keyof T]: [T[K], ISerializer<T[K], INamed<T[K]["$name"]>>];
  }>;
}
