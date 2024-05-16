import { Dict } from "./dict";
import { ex } from "./test";
import {
  DiscriminatedUnion,
  DiscriminatedUnionConfiguration,
} from "./discriminated-union";

describe("DiscriminatedUnion", () => {
  it("class definition with two arguments", () => {
    class A extends Dict({ type: "A", a: String }) {}
    const B = Dict({ type: "B", b: Number });
    const C = { type: "C" as const, c: Boolean };

    class Test extends DiscriminatedUnion([A, B, C]) {
      test = true as const;
    }

    type Inlined = A | { type: "B"; b: number } | { type: "C"; c: boolean };
    type Serialized =
      | { type: "A"; a: string }
      | { type: "B"; b: number }
      | { type: "C"; c: boolean };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Inlined>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ type: "A", a: "test" });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Inlined>(new A({ type: "A", a: "test" })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({
      type: "A",
      a: "test",
    }).ok;

    // Instantiation
    const b = new Test(new A({ type: "A", a: "test" }));
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Inlined>(new A({ type: "A", a: "test" })).ok;

    const c = new Test({ type: "B", b: 2 });
    ex(c).toBeInstanceOf(Test).ok;
    ex(c.value).toStrictEqual<Inlined>({ type: "B", b: 2 }).ok;

    const c2 = Test.deserialize({ type: "B", b: 2 });
    ex(c2).toBeInstanceOf(Test).ok;
    ex(c2.value).toStrictEqual<Inlined>({ type: "B", b: 2 }).ok;

    const d = new Test({ type: "C", c: true });
    ex(d).toBeInstanceOf(Test).ok;
    ex(d.value).toStrictEqual<Inlined>({ type: "C", c: true }).ok;

    const d2 = Test.deserialize({ type: "C", c: true });
    ex(d2).toBeInstanceOf(Test).ok;
    ex(d2.value).toStrictEqual<Inlined>({ type: "C", c: true }).ok;
  });

  it("class definition with constructors", () => {
    class A extends Dict({ type: "A", a: String }) {}
    class B {
      static type = "B" as const;
      type!: "B";
      a!: string;
      constructor({ type, a }: { type: "B"; a: string }) {
        Object.assign(this, { type, a });
      }

      static deserialize({ type, a }: { type: "B"; a: string }) {
        return new B({ type, a });
      }

      serialize() {
        return { type: this.type, a: this.a };
      }
    }

    class Test extends DiscriminatedUnion([A, B]) {
      test = true as const;
    }

    type Serialized = { type: "A"; a: string } | { type: "B"; a: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ type: "A", a: "a" });
    ex(a).toBeInstanceOf(Test).ok;
    const b = Test.deserialize({ type: "B", a: "b" });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(
      a.match({
        A: () => true as const,
        B: () => false as const,
      }),
    ).toBe<true | false>(true as const).ok;
    ex(
      a.match({
        _: () => true as const,
      }),
    ).toBe<true>(true as const).ok;
    ex(
      a.match(
        {
          B: () => true as const,
        },
        () => false as const,
      ),
    ).toBe<true | false>(false as const).ok;

    ex(a.test).toBe(true as const).ok;
    // Inherited prototype on deserialization
    ex(a.value).toBeInstanceOf<typeof A | typeof B>(A).ok;
    ex(b.value).toBeInstanceOf<typeof A | typeof B>(B).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ type: "A", a: "a" }).ok;
    ex(b.serialize()).toStrictEqual<Serialized>({ type: "B", a: "b" }).ok;

    // Instantiation
    const c = new Test(new A({ type: "A", a: "aa" }));
    ex(c).toBeInstanceOf(Test).ok;

    const d = new Test(new B({ type: "B", a: "bb" }));
    ex(d).toBeInstanceOf(Test).ok;

    // Inherited prototype
    ex(c.value).toBeInstanceOf<typeof A | typeof B>(A).ok;
    ex(c.value.a).toBe("aa").ok;

    ex(d.value).toBeInstanceOf<typeof A | typeof B>(B).ok;
    ex(d.value.a).toBe("bb").ok;
  });

  it("inline definition", () => {
    class A extends Dict({ type: "A", a: String }) {}
    const B = Dict({ type: "B", b: Number });

    class Test extends Dict({ nested: DiscriminatedUnion([A, B]) }) {}

    type Inlined = { nested: A | { type: "B"; b: number } };
    type Serialized = {
      nested: { type: "A"; a: string } | { type: "B"; b: number };
    };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Inlined>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ nested: { type: "A", a: "test" } });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toStrictEqual<Inlined["nested"]>(
      new A({ type: "A", a: "test" }),
    ).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({
      nested: { type: "A", a: "test" },
    }).ok;

    // Instantiation
    const b = new Test({ nested: { type: "B", b: 0 } });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.nested).toStrictEqual<Inlined["nested"]>({ type: "B", b: 0 }).ok;
  });

  it("referenced definition", () => {
    class A extends Dict({ type: "A" }) {}
    class B extends Dict({ type: "B" }) {}

    class Union extends DiscriminatedUnion([A, B]) {}
    class Test extends Dict({ nested: Union }) {}

    type Serialized = { nested: { type: "A" } | { type: "B" } };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: Union }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ nested: { type: "A" } });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toBeInstanceOf(Union).ok;
    ex(a.nested.value).toStrictEqual<Union["value"]>(new A({ type: "A" })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ nested: { type: "A" } }).ok;

    // Instantiation
    const b: Test = new Test({ nested: new Union(new A({ type: "A" })) });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.nested.value).toStrictEqual<A | B>(new A({ type: "A" })).ok;
  });

  it("mixin extension", () => {
    const Mixin = <const S extends DiscriminatedUnionConfiguration>(
      config: S,
    ) => {
      abstract class Mix extends DiscriminatedUnion(config) {
        deep = true as const;
        static deep = true as const;
        abstract abstract: true;
      }

      return Mix;
    };

    class A extends Dict({ type: "A" }) {}
    class B extends Dict({ type: "B" }) {}

    class Test extends Mixin([A, B]) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = { type: "A" } | { type: "B" };

    // Constructor parameters
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ type: "A" });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<A | B>(new A({ type: "A" })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ type: "A" }).ok;

    // Instantiation
    const b = new Test(new B({ type: "B" }));
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<A | B>(new B({ type: "B" })).ok;
  });

  it("mixin supersede", () => {
    const Testable = <const C extends DiscriminatedUnionConfiguration>(
      config: C,
    ) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return DiscriminatedUnion(config, I);
    };

    class A extends Dict({ type: "A" }) {}
    class B extends Dict({ type: "B" }) {}

    class Test extends Testable([A, B]) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor type
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    type Serialized = { type: "A" } | { type: "B" };

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ type: "A" });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Superseded prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<A | B>(new A({ type: "A" })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({
      type: "A",
    }).ok;

    // Instantiation
    const b = new Test(new B({ type: "B" }));
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Superseded prototype on instantiation
    ex(b.deep).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<A | B>(new B({ type: "B" })).ok;
  });
});
