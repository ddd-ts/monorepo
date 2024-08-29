// import type { INamed, INamedContructor } from "../interfaces/named";
// import { ISerializer, type Serialized } from "../interfaces/serializer";
// import { Named } from "../traits/named";
// import { Derive } from "@ddd-ts/traits";

// type ret<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

// type IsStringLiteral<T> = string extends T ? false : true;

// export class SerializerRegistry<
//   R extends [INamed, ISerializer<INamed, INamed>][] = [],
//   Instances extends R[number][0] = R[number][0],
// > {
//   store = new Map<string, any>();

//   __typesafety!: (params: Instances) => void;

//   add<
//     Class extends INamedContructor,
//     S extends ISerializer<InstanceType<Class>, INamed<Class["$name"]>>,
//   >(Class: Class, serializer: S) {
//     this.store.set(Class.$name, serializer);
//     return this as unknown as SerializerRegistry<
//       [...R, [InstanceType<Class>, S]]
//     >;
//   }

//   getForInstance<Instance extends Instances>(
//     instance: Instance,
//   ): IsStringLiteral<Instance["name"]> extends true
//     ? Instance extends unknown
//       ? Extract<
//           R[number],
//           [Instance, ISerializer<Instance, INamed<Instance["name"]>>]
//         >[1]
//       : never
//     : never {
//     //ISerializer<Instance, INamed<Instance["name"]>> {
//     return this.store.get(instance.name);
//   }

//   getForSerialized<S extends INamed<string>>(
//     serialized: S,
//   ): IsStringLiteral<S["name"]> extends true
//     ? S extends unknown
//       ? Extract<
//           R[number],
//           [INamed<S["name"]>, ISerializer<INamed<S["name"]>, INamed<S["name"]>>]
//         >[1]
//       : Extract<
//           R[number],
//           [INamed<S["name"]>, ISerializer<INamed<S["name"]>, INamed<S["name"]>>]
//         >[1]
//     : never {
//     // ISerializer<INamed<S["name"]>, INamed<S["name"]>> {
//     return this.store.get(serialized.name);
//   }

//   // serialize<Instance extends Instances>(
//   //   instance: Instance,
//   // ): IsStringLiteral<Instance["name"]> extends true
//   //   ? Serialized<Extract<R[number], [Instance, ISerializer<Instance>]>[1]>
//   //   : Serialized<ISerializer<Instance>> {
//   //   return this.getForInstance(instance).serialize(instance) as any;
//   // }

//   serialize<Instance extends Instances>(
//     instance: Instance,
//   ): ret<ret<typeof this.getForInstance<Instance>>["serialize"]> {
//     return this.getForInstance(instance).serialize(instance) as any;
//   }

//   // serialize2<Instance extends Instances>(
//   //   instance: Instance,
//   // ): IsStringLiteral<Instance["name"]> extends true ?
//   //   | Extract<R[number], [Instance, ISerializer<Instance, INamed<Instance["name"]>>]>[1]
//   //   | never{
//   //   return this.getForInstance(instance).serialize(instance) as any;
//   // }

//   deserialize2<
//     I extends Instances,
//     const S extends INamed<string> &
//       ReturnType<ISerializer<I>["serialize"]> = INamed<string> &
//       ReturnType<ISerializer<I>["serialize"]>,
//   >(
//     serialized: IsStringLiteral<S> extends true ? S : never,
//   ): IsStringLiteral<S["name"]> extends true
//     ? Extract<R[number], [INamed<S["name"]>, any]>[1] extends ISerializer<
//         infer T,
//         unknown
//       >
//       ? T
//       : never
//     : I {
//     return this.store.get(serialized.name).deserialize(serialized) as any;
//   }

//   deserialize<
//     const S extends
//       | ret<ret<typeof this.getForSerialized<Instances>>["serialize"]>
//       | ret<typeof this.serialize<Instances>>,
//   >(
//     serialize: S,
//   ): IsStringLiteral<S["name"]> extends true
//     ? ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
//     : ret<ret<typeof this.getForSerialized<S>>["deserialize"]>;
//   deserialize<const I extends Instances>(
//     serialized: INamed<Instances["name"]> & { version: number } & unknown,
//   ): I;
//   deserialize<const I = never, const S = Record<string, any>>(
//     serialized: INamed & { version: number } & S,
//   ): I;
//   deserialize(serialized: any): any {
//     return this.store.get(serialized.name).deserialize(serialized) as any;
//   }

//   deserialize4<
//     Instance = never,
//     I extends Extract<Instances, Instance> = Extract<Instances, Instance>,
//     const S extends
//       | ret<ret<typeof this.getForSerialized<I>>["serialize"]>
//       | ret<typeof this.serialize<I>> = any,
//   >(
//     serialized: S,
//   ): [Instance] extends [never]
//     ? IsStringLiteral<S["name"]> extends true
//       ? ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
//       : ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
//     : I {
//     return this.store.get(serialized.name).deserialize(serialized) as any;
//   }

//   deserializeFromUnsafeData<I extends Instances = Instances>(
//     serialized: any,
//   ): I | undefined {
//     return this.store.get(serialized.name)?.deserialize(serialized) as any;
//   }

//   deserialize3<
//     I extends Instances = Instances,
//     const S extends
//       | ret<typeof this.serialize<Instances>>
//       | { name: string; version: number } = { name: string; version: number },
//   >(
//     serialized: S,
//   ): IsStringLiteral<S["name"]> extends true
//     ? ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
//     : I {
//     return this.store.get(serialized.name).deserialize(serialized) as any;
//   }
// }

// type UnionToArray<U> = U extends any ? (arg: U) => void : never;

// export namespace SerializerRegistry {
//   export type For<T extends INamed[]> = SerializerRegistry<{
//     [K in keyof T]: [T[K], ISerializer<T[K], INamed<T[K]["name"]>>];
//   }>;
// }

// class A extends Derive(Named("A")) {}
// class B extends Derive(Named("B")) {}

// const reg = new SerializerRegistry()
//   .add(A, {} as ISerializer<A, INamed<"A"> & { value: string }>)
//   .add(B, {} as ISerializer<B, INamed<"B"> & { value: number }>);

// type check = SerializerRegistry.For<[A, B]>;

// reg.serialize(new A({}));

// const anyinst = reg.deserializeFromUnsafeData({
//   name: "" as string,
//   version: 2,
// });
// anyinst;
// //    ^?

// const inst = reg.deserialize({
//   name: "uA",
//   version: 1,
//   value: "2",
// });
// inst;
// // ^?
// function generic<X extends INamed, Y extends INamed>(x: X, y: Y) {
//   const r = {} as SerializerRegistry<
//     [[X, ISerializer<X, INamed>], [Y, ISerializer<Y, INamed>]]
//   >;

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
