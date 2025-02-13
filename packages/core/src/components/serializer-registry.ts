import type { IKinded, IKindedContructor } from "../interfaces/kinded";
import { ISerializer, type Serialized } from "../interfaces/serializer";
import { AutoSerializable, AutoSerializer } from "./auto-serializer";

type IsStringLiteral<T> = [string] extends [T] ? false : true;

type Pretty<T> = {
  [K in keyof T]: T[K];
} & {};

export class SerializerRegistry<
  R extends [IKinded, ISerializer<IKinded, IKinded>][] = [],
  Instances extends R[number][0] = R[number][0],
> {
  store = new Map<string, any>();

  // Ensure we can assign to a SR<[A,B]> only something that is SR<[A,B,...more]>
  // I used a function because its an contravariant position
  declare __typesafety: (params: Instances) => void;

  auto<Class extends IKindedContructor & AutoSerializable>(Class: Class) {
    const first = AutoSerializer.first(Class);
    this.store.set(Class.$kind, first);
    return this as unknown as SerializerRegistry<
      [...R, [InstanceType<Class>, typeof first]]
    >;
  }

  add<
    Class extends IKindedContructor,
    S extends ISerializer<InstanceType<Class>, IKinded<Class["$kind"]>>,
  >(Class: Class, serializer: S) {
    this.store.set(Class.$kind, serializer);
    return this as unknown as SerializerRegistry<
      [...R, [InstanceType<Class>, S]]
    >;
  }
  get<const I extends Instances["$kind"]>(
    kind: I | IKinded<I>,
  ): this extends SerializerRegistry<infer RRR, any>
    ? Extract<RRR[number], [IKinded<I>, any]>[1]
    : never {
    const key = typeof kind === "string" ? kind : kind.$kind;
    return this.store.get(key as any);
  }

  serialize<
    const I extends IKinded,
    const TH extends SerializerRegistry<any, I>,
  >(
    this: TH,
    instance: IsStringLiteral<I["$kind"]> extends true ? I : never,
  ): TH extends SerializerRegistry<infer RRR, any>
    ? Pretty<ReturnType<Extract<RRR[number], [I, any]>[1]["serialize"]>>
    : never;
  serialize<
    const I extends IKinded,
    const TH extends SerializerRegistry<any, I>,
  >(
    this: TH,
    instance: I,
  ): Pretty<Serialized<ISerializer<I, IKinded<I["$kind"]>>>>;
  serialize(instance: IKinded): unknown {
    const kind = instance.$kind;
    const serializer = this.store.get(kind);
    if (!serializer) {
      throw new Error(`No serializer for ${kind}`);
    }
    return serializer.serialize(instance);
  }

  deserialize<
    const TH extends SerializerRegistry<any, any>,
    const S extends IKinded,
  >(
    this: TH,
    serialized: IsStringLiteral<S["$kind"]> extends true ? S : never,
  ): TH extends SerializerRegistry<infer RRR, any>
    ? Extract<RRR[number], [IKinded<S["$kind"]>, any]>[0]
    : never;
  deserialize<const I extends Instances>(serialized: unknown): NoInfer<I>;
  // deserialize(serialized: unknown): unknown;
  deserialize(serialized: unknown): unknown {
    const kind =
      typeof serialized === "object" &&
      serialized !== null &&
      "$kind" in serialized &&
      typeof serialized.$kind === "string" &&
      serialized.$kind;

    if (!kind) {
      throw new Error("No $kind in serialized object");
    }

    const serializer = this.store.get(kind);
    if (!serializer) {
      throw new Error(`No serializer for ${kind}`);
    }

    return serializer.deserialize(serialized);
  }
}

export namespace SerializerRegistry {
  export type For<T extends IKinded[]> = SerializerRegistry<{
    [K in keyof T]: [T[K], ISerializer<T[K], IKinded<T[K]["$kind"]>>];
  }>;
}
