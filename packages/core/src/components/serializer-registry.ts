import type { INamed, INamedContructor } from "../interfaces/named";
import {
  ISerializer,
  PromiseOr,
  type Serialized,
} from "../interfaces/serializer";
import { AutoSerializable, AutoSerializer } from "./auto-serializer";

type IsStringLiteral<T> = [string] extends [T] ? false : true;

type Pretty<T> = {
  [K in keyof T]: T[K];
} & {};

type Merge<LEFT, RIGHT> = LEFT extends SerializerRegistry<infer LEFT_R, infer LEFT_I>
  ? RIGHT extends SerializerRegistry<infer RIGHT_R, infer RIGHT_I>
  ? SerializerRegistry<[...LEFT_R, ...RIGHT_R], [...LEFT_R, ...RIGHT_R][number][0]>
  : never
  : never

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

  merge<
    TH extends SerializerRegistry<any, never>,
    OTHER extends SerializerRegistry<any, any>,
  >(this: TH, other: OTHER): Merge<TH, OTHER>
  merge<
    TH extends SerializerRegistry<any, any>,
    OTHER extends SerializerRegistry<any, any>,
  >(this: TH, other: OTHER): Merge<TH, OTHER> {
    return SerializerRegistry.merge(this as any, other) as any;
  }

  static merge<
    LEFT extends SerializerRegistry<any, any>,
    RIGHT extends SerializerRegistry<any, any>,
  >(
    left: LEFT,
    right: RIGHT,
  ): Merge<LEFT, RIGHT> {
    const merged = new SerializerRegistry();
    for (const [key, value] of left.store) {
      merged.store.set(key, value);
    }
    for (const [key, value] of right.store) {
      if (merged.store.has(key)) {
        throw new Error("Serializer already exists in left");
      }
      merged.store.set(key, value);
    }
    return merged as any;
  }

  serialize<
    const I extends INamed,
    const TH extends SerializerRegistry<any, I>,
  >(
    this: TH,
    instance: IsStringLiteral<I["$name"]> extends true ? I : never,
  ): TH extends SerializerRegistry<infer RRR, any>
    ? PromiseOr<
      Pretty<ReturnType<Extract<RRR[number], [I, any]>[1]["serialize"]>>
    >
    : never;
  serialize<
    const I extends INamed,
    const TH extends SerializerRegistry<any, I>,
  >(
    this: TH,
    instance: I,
  ): PromiseOr<Pretty<Serialized<ISerializer<I, INamed<I["$name"]>>>>>;
  serialize(instance: INamed): PromiseOr<unknown> {
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
    ? PromiseOr<Extract<RRR[number], [INamed<S["$name"]>, any]>[0]>
    : never;
  deserialize<const I extends Instances>(
    serialized: unknown,
  ): PromiseOr<I>;
  // deserialize(serialized: unknown): unknown;
  deserialize(serialized: unknown): PromiseOr<unknown> {
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
