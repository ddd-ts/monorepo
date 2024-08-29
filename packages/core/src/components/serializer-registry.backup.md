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



// import { Derive } from "@ddd-ts/traits";
// import type { INamed, INamedContructor } from "../interfaces/named";
// import { ISerializer, type Serialized } from "../interfaces/serializer";
// import { Named } from "../traits/named";
// export type UnionToIntersection<U> = (
//   U extends unknown
//     ? (k: U) => void
//     : never
// ) extends (k: infer I) => void
//   ? I
//   : never;
// type ret<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

// type IsStringLiteral<T> = string extends T ? false : true;

// type Registered = [INamed, ISerializer<INamed, INamed>][];

// type IsUnion<T> = [T] extends [never] ? false : true;

// // type FindInstanceFor<R extends Registered, T extends INamed> = R extends [
// //   infer First,
// //   ...infer Rest extends Registered,
// // ]
// //   ? First extends [any, infer S extends ISerializer<INamed<T["name"]>, any>]
// //     ? S extends ISerializer<infer I extends INamed, any>
// //       ? [(I["name"] & T["name"])] extends [infer U & infer G]
// //         ? [U, G]
// //         : never
// //       : never
// //     : FindInstanceFor<Rest, T>
// //   : never;

// type FindInstanceFor<R extends Registered, T extends INamed> = R extends [
//   infer First,
//   ...infer Rest extends Registered,
// ]
//   ? First extends [
//       infer F extends INamed<T["name"]>,
//       infer S extends ISerializer<INamed<T["name"]>, INamed<T["name"]>>,
//     ]
//     ? S extends ISerializer<
//         infer I extends INamed<infer J extends T["name"]>,
//         INamed<T["name"]> & INamed<F["name"]>
//       >
//       ? [J]
//       : 2
//     : FindInstanceFor<Rest, T>
//   : 3;

// function generic2<X extends INamed, Y extends INamed>(x: X, y: Y) {
//   type registry = SerializerRegistry.For<[X, Y]>;
//   type registered = registry extends SerializerRegistry<infer R> ? R : never;
//   type x = FindInstanceFor<registered, X>;
//   //   ^?
//   type y = FindInstanceFor<registered, Y>;
//   //   ^?
// }

// export class SerializerRegistry<
//   R extends Registered = [],
//   in Instances extends R[number][0] = R[number][0],
// > {
//   store = new Map<string, any>();

//   // Ensure we can assign to a SR<[A,B]> only something that is SR<[A,B,...more]>
//   // I used a function because its an contravariant position
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
//   ): Extract<
//     R[number],
//     [Instance, ISerializer<Instance, INamed<Instance["name"]>>]
//   >[1] {
//     return this.store.get(instance.name);
//   }

//   getForSerialized<S extends INamed<string>>(
//     serialized: S,
//   ): IsStringLiteral<S["name"]> extends true
//     ? Extract<
//         R[number],
//         [INamed<S["name"]>, ISerializer<INamed<S["name"]>, INamed<S["name"]>>]
//       >[1]
//     : never {
//     return this.store.get(serialized.name);
//   }

//   serialize<const Instance extends Instances>(
//     instance: Instance,
//   ): Promise<
//     ret<ret<typeof this.getForInstance<Instance>>["serialize"]>
//   > extends infer U extends Promise<
//     Serialized<ISerializer<infer H extends Instance, INamed<Instance["name"]>>>
//   >
//     ? Promise<Serialized<ISerializer<H, INamed<Instance["name"]>>>>
//     : never {
//     const serializer = this.getForInstance(instance);
//     if (!serializer) {
//       throw new Error(`Could not find serializer for ${instance.name}`);
//     }
//     return serializer.serialize(instance) as any;
//   }

//   deserialize2<const S extends INamed<Instances["name"]>>(
//     serialized: S,
//     // ): S extends infer U extends [infer X extends INamed<S["name"]>]
//     //   ? X
//     //   : never {
//   ): R[number] extends [
//     infer X extends INamed<S["name"]>,
//     ISerializer<any, infer Y extends INamed<S["name"]> & S>,
//   ]
//     ? [X, Y]
//     : never {
//     const serializer = this.store.get(serialized.name);
//     if (!serializer) {
//       throw new Error(`Could not find serializer for ${serialized.name}`);
//     }
//     return serializer.deserialize(serialized) as any;
//   }

//   deserialize<
//     const S extends
//       | ret<ret<typeof this.getForSerialized<Instances>>["serialize"]>
//       | ret<typeof this.serialize<Instances>>,
//   >(
//     serialize: S,
//   ): Promise<
//     IsStringLiteral<S["name"]> extends true
//       ? ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
//       : ret<ret<typeof this.getForSerialized<S>>["deserialize"]>
//   >;
//   deserialize<const I extends Instances>(
//     serialized: INamed<Instances["name"]> & unknown,
//   ): Promise<I>;
//   deserialize<
//     const I extends Instances = Instances,
//     const S = Record<string, any>,
//   >(serialized: INamed & S): Promise<I>;
//   deserialize(serialized: any): any {
//     const serializer = this.store.get(serialized.name);
//     if (!serializer) {
//       throw new Error(`Could not find serializer for ${serialized.name}`);
//     }
//     return serializer.deserialize(serialized) as any;
//   }

//   deserialize3<const S extends INamed>(
//     serialized: S,
//     // ): S extends infer U extends [infer X extends INamed<S["name"]>]
//     //   ? X
//     //   : never {
//   ): R extends [
//     [any, ISerializer<infer U extends INamed<S["name"]>, any>],
//     [any, any],
//   ]
//     ? [U["name"] | S["name"]]
//     : never {
//     const serializer = this.store.get(serialized.name);
//     if (!serializer) {
//       throw new Error(`Could not find serializer for ${serialized.name}`);
//     }
//     return serializer.deserialize(serialized) as any;
//   }
// }

// export namespace SerializerRegistry {
//   export type For<T extends INamed[]> = SerializerRegistry<{
//     [K in keyof T]: [
//       T[K] & INamed<T[K]["name"]>,
//       ISerializer<T[K], INamed<T[K]["name"]>>,
//     ];
//   }>;
// }
// async function generic<X extends INamed, Y extends INamed>(x: X, y: Y) {
//   const r = {} as SerializerRegistry.For<[X, Y]>;

//   type xserialized = ret<typeof r.serialize<X>>;

//   const xs = await r.serialize(x);
//   const ys = await r.serialize(y);

//   const xi = await r.deserialize3(xs);
//   //     ^?
//   const yi = await r.deserialize3(ys);

//   const xs2 = r.serialize(xi);
//   const ys2 = r.serialize<Y>(yi);

//   // const xi2 = r.deserialize(xs2);
//   // const yi2 = r.deserialize<Y>(ys2);

//   return reg;
// }

// class A extends Derive(Named("A")) {}
// class B extends Derive(Named("B")) {}

// const reg = new SerializerRegistry()
//   .add(A, {} as ISerializer<A, INamed<"A"> & { value: string }>)
//   .add(B, {} as ISerializer<B, INamed<"B"> & { value: number }>);
// //
// type check = SerializerRegistry.For<[A, B]>;

// reg.serialize(new A({}));
// reg.serialize(new B({}));

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

// function genericWithDep<X extends INamed, Y extends INamed>(
//   x: X,
//   y: Y,
//   registry: SerializerRegistry.For<[X, Y]>,
// ) {
//   const inst = registry.deserialize<X>({ name: "test", version: 1 });
//   return inst;
// }

// genericWithDep(new A({}), new B({}), reg);
