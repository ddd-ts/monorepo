import type { INamed, INamedContructor } from "../interfaces/named";
import { ISerializer, type Serialized } from "../interfaces/serializer";

type ret<T extends (...args: any[]) => any> = Awaited<ReturnType<Awaited<T>>>;

type IsStringLiteral<T> = string extends T ? false : true;

export class SerializerRegistry<
  R extends [INamed, ISerializer<INamed, INamed>][] = [],
  Instances extends R[number][0] = R[number][0],
> {
  store = new Map<string, any>();

  // Ensure we can assign to a SR<[A,B]> only something that is SR<[A,B,...more]>
  // I used a function because its an contravariant position
  __typesafety!: (params: Instances) => void;

  add<
    Class extends INamedContructor,
    S extends ISerializer<InstanceType<Class>, INamed<Class["$name"]>>,
  >(Class: Class, serializer: S) {
    this.store.set(Class.$name, serializer);
    return this as unknown as SerializerRegistry<
      [...R, [InstanceType<Class>, S]]
    >;
  }

  getForInstance<Instance extends Instances>(
    instance: Instance,
  ): Extract<
    R[number],
    [Instance, ISerializer<Instance, INamed<Instance["name"]>>]
  >[1] {
    return this.store.get(instance.name);
  }

  getForSerialized<S extends INamed<string>>(
    serialized: S,
  ): IsStringLiteral<S["name"]> extends true
    ? Extract<
        R[number],
        [INamed<S["name"]>, ISerializer<INamed<S["name"]>, INamed<S["name"]>>]
      >[1]
    : never {
    return this.store.get(serialized.name);
  }

  serialize<const I extends Instances>(
    // When the registry has concrete instances
    instance: IsStringLiteral<I["name"]> extends true ? I : never,
  ): Promise<ret<ret<typeof this.getForInstance<I>>["serialize"]>>;
  serialize<const I extends Instances>(
    // When the registry has generic instances
    instance: I,
  ): Promise<Serialized<ISerializer<I, INamed<I["name"]>>>>;
  serialize(instance: any): any {
    const serializer = this.getForInstance(instance);
    if (!serializer) {
      throw new Error(`Could not find serializer for ${instance.name}`);
    }
    return serializer.serialize(instance) as any;
  }

  deserialize<const S extends ret<typeof this.serialize<Instances>>>(
    // When the registry has concrete instances
    serialize: IsStringLiteral<S["name"]> extends true
      ? S & Extract<ReturnType<R[number][1]["serialize"]>, INamed<S["name"]>>
      : never,
  ): Promise<ReturnType<ret<typeof this.getForSerialized<S>>["deserialize"]>>;
  deserialize<const I extends Instances>(
    // When the method is called with a parameter to narrow down the return type
    serialized: INamed<Instances["name"]> & unknown,
  ): Promise<I>;
  deserialize<const S extends INamed>(
    // I dont know why this works, but it does.
    serialize: IsStringLiteral<Instances["name"]> extends true
      ? IsStringLiteral<S["name"]> extends true
        ? INamed<S["name"]> extends Instances
          ? Extract<ReturnType<R[number][1]["serialize"]>, INamed<S["name"]>>
          : S
        : Extract<ReturnType<R[number][1]["serialize"]>, INamed<S["name"]>>
      : S,
  ): Promise<Instances>;
  deserialize(serialized: any): any {
    const serializer = this.store.get(serialized.name);
    if (!serializer) {
      throw new Error(`Could not find serializer for ${serialized.name}`);
    }
    return serializer.deserialize(serialized) as any;
  }
}

export namespace SerializerRegistry {
  export type For<T extends INamed[]> = SerializerRegistry<{
    [K in keyof T]: [
      T[K] & INamed<T[K]["name"]>,
      ISerializer<T[K], INamed<T[K]["name"]>>,
    ];
  }>;
}
