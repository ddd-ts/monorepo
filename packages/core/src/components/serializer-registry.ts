import type { INamed, INamedContructor } from "../interfaces/named";
import { ISerializer } from "../interfaces/serializer";

type ret<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

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
  ): IsStringLiteral<Instance["name"]> extends true
    ? Instance extends unknown
      ? Extract<
          R[number],
          [Instance, ISerializer<Instance, INamed<Instance["name"]>>]
        >[1]
      : never
    : never {
    return this.store.get(instance.name);
  }

  getForSerialized<S extends INamed<string>>(
    serialized: S,
  ): IsStringLiteral<S["name"]> extends true
    ? S extends unknown
      ? Extract<
          R[number],
          [INamed<S["name"]>, ISerializer<INamed<S["name"]>, INamed<S["name"]>>]
        >[1]
      : Extract<
          R[number],
          [INamed<S["name"]>, ISerializer<INamed<S["name"]>, INamed<S["name"]>>]
        >[1]
    : never {
    return this.store.get(serialized.name);
  }

  serialize<Instance extends Instances>(
    instance: Instance,
  ): ret<ret<typeof this.getForInstance<Instance>>["serialize"]> {
    const serializer = this.getForInstance(instance);
    if (!serializer) {
      throw new Error(`Could not find serializer for ${instance.name}`);
    }
    return serializer.serialize(instance) as any;
  }

  deserialize<
    const S extends
      | ret<ret<typeof this.getForSerialized<Instances>>["serialize"]>
      | ret<typeof this.serialize<Instances>>,
  >(
    serialize: S,
  ): IsStringLiteral<S["name"]> extends true
    ? ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
    : ret<ret<typeof this.getForSerialized<S>>["deserialize"]>;
  deserialize<const I extends Instances>(
    serialized: INamed<Instances["name"]> & unknown,
  ): I;
  deserialize<
    const I extends Instances = Instances,
    const S = Record<string, any>,
  >(serialized: INamed & S): I;
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
    [K in keyof T]: [T[K], ISerializer<T[K], INamed<T[K]["name"]>>];
  }>;
}

// class A extends Derive(Named("A")) {}
// class B extends Derive(Named("B")) {}

// const reg = new SerializerRegistry()
//   // .add(A, {} as ISerializer<A, INamed<"A"> & { value: string }>)
//   .add(B, {} as ISerializer<B, INamed<"B"> & { value: number }>);
// //
// type check = SerializerRegistry.For<[A, B]>;

// reg.serialize(new A({})).value;
// reg.serialize(new B({})).value;

// const anyinst = reg.deserialize({
//   name: "A",
//   version: 2,
//   value: "2",
// });

// anyinst;
// //    ^?

// const inst = reg.deserialize({
//   name: "idk",
//   payload: "unknown",
//   version: 2,
// });

// inst;
// // ^?
// function generic<X extends INamed, Y extends INamed>(x: X, y: Y) {
//   const r = {} as SerializerRegistry.For<[X, Y]>;

//   type xserialized = ret<typeof r.serialize<X>>;

//   const xs = r.serialize(x);
//   const ys = r.serialize(y);

//   const xi = r.deserialize<X>(xs);
//   const yi = r.deserialize<Y>(ys);

//   const xs2 = r.serialize(xi);
//   const ys2 = r.serialize(yi);

//   const xi2 = r.deserialize(xs2);
//   const yi2 = r.deserialize<Y>(ys2);

//   return reg;
// }

// function genericWithDep<X extends INamed, Y extends INamed>(
//   x: X,
//   y: Y,
//   registry: SerializerRegistry.For<[X, Y]>,
// ) {
//   const inst = registry.deserialize<X>({ name: "test", version: 1 });
//   return inst;
// }

// genericWithDep(new A({}), new B({}), reg);
