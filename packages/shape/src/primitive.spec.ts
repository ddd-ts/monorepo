import { Primitive, type PrimitiveShorthand } from "./primitive";
import { Dict } from "./dict";
import { ex } from "./test";

describe("Primitive", () => {
  it("class definition", () => {
    class Test extends Primitive(String) {
      test = true as const;
    }

    // Constructor parameters
    ex(Test).toHaveFirstParam<string>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<string>().ok;
    const a = Test.deserialize("a");
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe<string>("a").ok;

    // Serialization
    ex(a.serialize()).toBe<string>("a").ok;

    // Instantiation
    const b = new Test("a");
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe<string>("a").ok;
  });

  it("inline definition", () => {
    class Test extends Dict({ a: Primitive(String) }) {
      test = true as const;
    }

    type Serialized = { a: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ a: "a" });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.a).toBe<string>("a").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ a: "a" }).ok;

    // Instantiation
    const b = new Test({ a: "a" });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.a).toBe<string>("a").ok;
  });

  it("referenced definition", () => {
    class A extends Primitive(String) {}
    class Test extends Dict({ a: A }) {
      test = true as const;
    }

    type Serialized = { a: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ a: A }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ a: "a" });
    ex(a).toBeInstanceOf(Test).ok;

    // Preserve reference
    ex(a.a).toBeInstanceOf(A);
    ex(a.a.value).toBe<string>("a").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ a: "a" }).ok;

    // Instantiation
    const b = new Test({ a: new A("a") });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.a).toBeInstanceOf(A);
    ex(b.a.value).toBe<string>("a").ok;
  });

  it("mixin extension", () => {
    const Testable = <S extends PrimitiveShorthand>(shape: S) => {
      abstract class I extends Primitive(shape) {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return I;
    };

    class Test extends Testable(Number) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor parameters
    ex(Test).toHaveFirstParam<number>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<number>().ok;
    const a = Test.deserialize(1);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual(1).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual(1).ok;

    // Instantiation
    const b = new Test(2);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual(2).ok;
  });

  it("mixin supersede", () => {
    const Testable = <S extends PrimitiveShorthand>(shape: S) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Primitive(shape, I);
    };

    class Test extends Testable(Number) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor parameters
    ex(Test).toHaveFirstParam<number>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<number>().ok;
    const a = Test.deserialize(1);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Superseded prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe(1).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual(1).ok;

    // Instantiation
    const b = new Test(2);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Superseded prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe(2).ok;
  });
});
