import { Derive } from "@ddd-ts/traits";
import type { INamed } from "../interfaces/named";
import { ISerializer, type Serialized } from "../interfaces/serializer";
import { SerializerRegistry } from "./serializer-registry";
import { AutoSerializer } from "./auto-serializer";
import { NamedShape } from "../traits/shaped";
import { EsEvent } from "../makers/es-event";
import { Shape } from "@ddd-ts/shape";

async function generic<X extends INamed, Y extends INamed>(
  x: X,
  y: Y,
  r: SerializerRegistry.For<[X, Y]>,
) {
  const xs = await r.serialize(x);
  // { version: number; } & INamed<X["name"]>
  const xsCheck: Serialized<ISerializer<X, INamed<X["$name"]>>> = xs;

  const ys = await r.serialize(y);
  // { version: number; } & INamed<Y["name"]>
  const ysCheck: Serialized<ISerializer<Y, INamed<Y["$name"]>>> = ys;

  const xi = await r.deserialize(xs);
  // I wish it could narrow down to X directly, but it's fine
  const xiCheck: X | Y = xi;

  const yi = await r.deserialize<Y>(ys);
  // Because of the explicit type, it's narrowed down to Y.
  // There are constraints in place to prevent passing something that is not in the registry.
  const yiCheck: Y = yi;

  const xs2 = await r.serialize(xi);
  // this is weird, but its a direct consequence of not being able to narrow down the type of xi
  // to the registered instance corresponding to xs
  // its still valid tho, it the union of the two possible serialized types
  // even tho it looks disgusting
  const xs2Check: { version: number } & INamed<(typeof xi)["$name"]> = xs2;

  const ys2 = await r.serialize(yi);
  // this is the same as above, but for Y
  // But this time, it's not a union, it's a direct type
  // because the type of yi is already narrowed down to Y
  const ys2Check: { version: number } & INamed<Y["$name"]> = ys2;
  const ys2Check2: typeof ys = ys2; // hooraay
}

async function concrete() {
  class A extends Derive(NamedShape("A", { value: String })) {
    static new() {
      return new A({ value: "2" });
    }
  }

  A.new().serialize();

  class ASerializer extends AutoSerializer(A, 1) { }
  class B extends Derive(NamedShape("B", { value: Number })) {
    static new() {
      return new B({ value: 2 });
    }
  }
  new ASerializer().serialize;
  class BSerializer extends AutoSerializer(B, 1) { }

  const r = new SerializerRegistry()
    .add(A, new ASerializer())
    .add(B, new BSerializer());

  const as = await r.serialize(A.new());
  const asCheck: { version: 1; $name: "A"; value: string } = as;

  const bs = await r.serialize(B.new());
  const bsCheck: { version: 1; $name: "B"; value: number } = bs;

  const ai = await r.deserialize(as);
  const aiCheck: A = ai;

  const bi = await r.deserialize(bs);
  const biCheck: B = bi;

  const as2 = await r.serialize(ai);
  const as2Check: { version: 1; $name: "A"; value: string } = as2;

  const bs2 = await r.serialize(bi);
  const bs2Check: { version: 1; $name: "B"; value: number } = bs2;

  const knownButIncomplete = await r.deserialize({ $name: "A" });
  const knownButIncompleteCheck: A | B = knownButIncomplete;
  // This is fine, we dont always have the full data type
  // As long as we have the name, we must trust the serializer to handle it

  const unknown = await r.deserialize({ $name: "C" as string });
  const unknownCheck: A | B = unknown;
  // I dont know if this should be never
  // Maybe there are cases where we dont even have the name type
  // Anyway, it restricts the type to A | B and will throw an error
  // If we effectively try to use it with C

  const unkownName = await r.deserialize({} as unknown);

  const knownAndComplete = await r.deserialize({
    $name: "A",
    version: 1,
    value: "2",
  });
  const knownAndCompleteCheck: A = knownAndComplete;
  // This is fine, we have the full data type, so it's narrowed down to A

  const knownAndMalformed = await r.deserialize({
    $name: "A",
    version: 1,
    value: 2,
  });
  const knownAndMalformedCheck: A | B = knownAndMalformed;
  // This should be an error as we are explicitly passing the wrong type
  // But I cant figure out how to make that fail
  // and at the same time, allow uncomplete data type
  // TODO: Find a way to make this fail (low priority)

  const compatibleRegistries: SerializerRegistry.For<[A, B]> = r;

  generic(A.new(), B.new(), r);
}

async function abstract() {
  class A extends EsEvent("A", { value: String }) { }
  class AS extends AutoSerializer(A, 1) { }

  class B extends EsEvent("B", { value: Number }) { }
  class BS extends AutoSerializer(B, 1) { }

  class C extends EsEvent("C", { value: Date }) { }
  class CS extends AutoSerializer(C, 1) { }

  const registry = new SerializerRegistry()
    .add(A, new AS())
    .add(B, new BS())
    .add(C, new CS());

  type Actual = typeof registry;
  type Expected = SerializerRegistry.For<[B]>;

  // check if the serialize method is compatible with supersetting
  type AT = Actual["serialize"];
  type ET = Expected["serialize"];
  const c: ET = {} as AT;

  const a: Serialized<AS> = await registry.serialize(A.new({ value: "test" }));
  const r: Expected = registry;
}

async function merge() {
  class A extends EsEvent("A", { value: String }) { }
  class AS extends AutoSerializer(A, 1) { }
  function moduleA() {
    return new SerializerRegistry().add(A, new AS());
  }

  class B extends EsEvent("B", { value: Number }) { }
  class BS extends AutoSerializer(B, 1) { }
  function moduleB() {
    return new SerializerRegistry().add(B, new BS());
  }

  const mergedInstance = moduleA().merge(moduleB());
  const mergedStatic = SerializerRegistry.merge(moduleA(), moduleB());

  const resultInstance = await mergedInstance.serialize(
    A.new({ value: "test" }),
  );
  const resultStatic = await mergedStatic.serialize(A.new({ value: "test" }));
}

type Valid<T> = never extends T ? false : true;

async function mergeChain() {
  class A extends Derive(NamedShape("A", { string: String })) { }
  class ASerializer extends AutoSerializer(A, 1) { }
  const aSerializerRegistry = new SerializerRegistry().add(A, new ASerializer())

  class B extends Derive(NamedShape("B", { number: Number })) { }
  class BSerializer extends AutoSerializer(B, 1) { }
  const bSerializerRegistry = new SerializerRegistry().add(B, new BSerializer())

  class C extends Derive(NamedShape("C", { boolean: Boolean })) { }
  class CSerializer extends AutoSerializer(C, 1) { }
  const cSerializerRegistry = new SerializerRegistry().add(C, new CSerializer())

  class D extends Derive(NamedShape("D", { boolean: Boolean })) { }
  class DSerializer extends AutoSerializer(D, 1) { }
  const dSerializerRegistry = new SerializerRegistry().add(D, new DSerializer())

  const a = new SerializerRegistry().merge(aSerializerRegistry).merge(bSerializerRegistry).merge(cSerializerRegistry).merge(dSerializerRegistry);
  const b: SerializerRegistry.For<[A, B, C]> = a;
}

it("pass", () => {
  expect(true).toBeTruthy();
});
