import { Either, type EitherConfiguration } from "./either";
import { Dict } from "./dict";
import { ex } from "./test";
import { Shape } from "./_";

describe("Either", () => {
  it("class definition with two arguments", () => {
    class A extends Shape({ value: Number }) { }
    class B extends Shape({ value: String }) { }
    class Test extends Either({ A, B }) {
      test = true as const;
    }

    type Serialized = { _key: "A", value: number } | { _key: "B", value: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ _key: "A", value: 1 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<A | B>(new A({ value: 1 })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ _key: "A", value: 1 }).ok;

    // Instantiation
    const b = new Test(new B({ value: "1" }));
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<A | B>(new B({ value: "1" })).ok;
  });

  it("class definition with constructors", () => {
    class A extends Dict({ a: String }) { }
    class B {
      a!: string;
      constructor({ a }: { a: string }) {
        Object.assign(this, { a });
      }

      static deserialize({ a }: { a: string }) {
        return new B({ a });
      }

      serialize() {
        return { a: this.a };
      }
    }

    class Test extends Either({ A, B }) {
      test = true as const;
    }

    type Serialized = { _key: "A", a: string } | { _key: "B", a: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ _key: "A", a: "test" });
    ex(a).toBeInstanceOf(Test).ok;
    const b = Test.deserialize({ _key: "B", a: "test" });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(
      a.match({
        A: () => true as const,
        B: () => false as const,
      })
    ).toBe<true | false>(true as const).ok;
    ex(
      a.match({
        _: () => true as const,
      })
    ).toBe<true>(true as const).ok;
    ex(
      a.match({
        B: () => true as const,
      }, () => false as const)
    ).toBe<true | false>(false as const).ok;

    ex(a.test).toBe(true as const).ok;
    // Inherited prototype on deserialization
    ex(a.value).toBeInstanceOf<typeof A | typeof B>(A).ok;
    ex(b.value).toBeInstanceOf<typeof A | typeof B>(B).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ _key: "A", a: "test" }).ok;
    ex(b.serialize()).toStrictEqual<Serialized>({ _key: "B", a: "test" }).ok;

    // Instantiation
    const c = new Test(new A({ a: "test" }));
    ex(c).toBeInstanceOf(Test).ok;

    const d = new Test(new B({ a: "test" }));
    ex(d).toBeInstanceOf(Test).ok;

    // Inherited prototype
    ex(c.value).toBeInstanceOf<typeof A | typeof B>(A).ok;
    ex(c.value.a).toBe("test").ok;

    ex(d.value).toBeInstanceOf<typeof A | typeof B>(B).ok;
    ex(d.value.a).toBe("test").ok;
  });

  it("inline definition", () => {
    class A extends Shape({ value: Number }) { }
    class B extends Shape({ value: String }) { }
    class Test extends Dict({ nested: Either({ A, B }) }) { }

    type Serialized = { nested: { _key: "A", value: number } | { _key: "B", value: string } };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: A | B }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ nested: { _key: "A", value: 1 } });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toStrictEqual<A | B>(new A({ value: 1 })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ nested: { _key: "A", value: 1 } })
      .ok;

    // Instantiation
    const b = new Test({ nested: new B({ value: "1" }) });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.nested).toStrictEqual<A | B>(new B({ value: "1" })).ok;
  });

  it("referenced definition", () => {
    class B extends Shape({ value: Number }) { }
    class C extends Shape({ value: String }) { }
    class A extends Either({ B, C }) { }
    class Test extends Dict({ nested: A }) { }

    type Serialized = { nested: { _key: "B", value: number } | { _key: "C", value: string } };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: A }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ nested: { _key: "B", "value": 1 } });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toBeInstanceOf(A).ok;
    ex(a.nested.value).toStrictEqual<B | C>(new B({ value: 1 })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ nested: { _key: "B", value: 1 } })
      .ok;

    // Instantiation
    const b: Test = new Test({ nested: new A(new C({ value: "1" })) });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.nested.value).toStrictEqual<B | C>(new C({ value: "1" })).ok;
  });

  it("mixin extension", () => {
    const Mixin = <const S extends EitherConfiguration>(either: S) => {
      abstract class Mix extends Either(either) {
        deep = true as const;
        static deep = true as const;
        abstract abstract: true;
      }

      return Mix;
    };

    class A extends Shape({ value: Number }) { }
    class B extends Shape({ value: String }) { }
    class Test extends Mixin({ A, B }) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = { _key: "A", value: number } | { _key: "B", value: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ _key: "A", value: 1 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<A | B>(new A({ value: 1 })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ _key: "A", value: 1 }).ok;

    // Instantiation
    const b = new Test(new B({ value: "1" }));
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<A | B>(new B({ value: "1" })).ok;
  });

  it("mixin supersede", () => {
    const Testable = <const C extends EitherConfiguration>(config: C) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Either(config, I);
    };

    class A extends Shape({ value: Number }) { }
    class B extends Shape({ value: String }) { }

    class Test extends Testable({ A, B }) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor type
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    type Serialized = { _key: "A", value: number } | { _key: "B", value: string };

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ _key: "A", value: 1 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Superseded prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<A | B>(new A({ value: 1 })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ _key: "A", value: 1 }).ok;

    // Instantiation
    const b = new Test(new B({ value: "1" }));
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Superseded prototype on instantiation
    ex(b.deep).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<A | B>(new B({ value: "1" })).ok;
  });
});
