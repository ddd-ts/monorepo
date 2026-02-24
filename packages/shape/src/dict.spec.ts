import { Dict, type DictShorthand } from "./dict";
import { Primitive } from "./primitive";
import { ex } from "./test";

describe("Dict", () => {
  it("class definition", () => {
    class Test extends Dict({
      a: Primitive(String),
      b: Number,
    }) {
      test = true as const;
    }

    type Serialized = { a: string; b: number };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ a: "a", b: 1 });
    expect(a).toBeInstanceOf(Test);

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype from deserialization
    ex(a.a).toBe("a").ok;
    ex(a.b).toBe(1).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual({ a: "a", b: 1 }).ok;

    // Instantiation
    const b = new Test({ a: "a", b: 1 });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype from instantiation
    ex(b.a).toBe("a").ok;
    ex(b.b).toBe(1).ok;
  });

  it("inline definition", () => {
    class Test extends Dict({
      shorthand: { short: String },
      longhand: Dict({ long: Number }),
    }) {
      test = true as const;
    }

    type Serialized = {
      shorthand: { short: string };
      longhand: { long: number };
    };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({
      shorthand: { short: "test" },
      longhand: { long: 1 },
    });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true);

    // Inherited prototype from deserialization
    ex(a.shorthand).toStrictEqual({ short: "test" }).ok;
    ex(a.longhand).toStrictEqual({ long: 1 }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual({
      shorthand: { short: "test" },
      longhand: { long: 1 },
    }).ok;

    // Instantiation
    const b = new Test({ shorthand: { short: "test" }, longhand: { long: 1 } });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype
    ex(b.shorthand).toStrictEqual({ short: "test" }).ok;
    ex(b.longhand).toStrictEqual({ long: 1 }).ok;
  });

  it("referenced definition", () => {
    class A extends Dict({ a: Primitive(Number) }) {}

    class Test extends Dict({ nested: A }) {
      test = true as const;
    }

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: A }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<{ nested: { a: number } }>().ok;
    const a = Test.deserialize({ nested: { a: 1 } });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual({ nested: { a: 1 } }).ok;

    // Instantiation
    const b = new Test({ nested: new A({ a: 2 }) });
    ex(b).toBeInstanceOf(Test);

    // Inherited prototype
    ex(b.nested).toBeInstanceOf(A);
    ex(b.nested.a).toBe(2);
  });

  it("mixin extension", () => {
    const Testable = <S extends DictShorthand>(shape: S) => {
      // Dict does not support not specifying the specific keys
      // of the shape at the extends level.
      // This is due to the fact that the shape is not known at the
      // time of the class definition, thus the returned instance
      // would have unknown members at compile time.
      // Use mixin supersede instead.
      abstract class I extends Dict({ nested: shape }) {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return I;
    };

    class Test extends Testable({ a: Primitive(Number) }) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: { a: number } }>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<{ nested: { a: number } }>().ok;
    const a = Test.deserialize({ nested: { a: 1 } });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toStrictEqual({ a: 1 }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual({ nested: { a: 1 } }).ok;

    // Instantiation
    const b = new Test({ nested: { a: 2 } });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.nested).toStrictEqual({ a: 2 }).ok;
  });

  it("mixin supersede", () => {
    const Testable = <S extends DictShorthand>(shape: S) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Dict(shape, I);
    };

    class Test extends Testable({ a: Primitive(Number) }) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ a: number }>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<{ a: number }>().ok;
    const a = Test.deserialize({ a: 1 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Superseded prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.a).toBe(1).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual({ a: 1 }).ok;

    // Instantiation
    const b = new Test({ a: 2 });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Superseded prototype on instantiation
    ex(b.deep).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Inherited prototype on instantiation
    ex(b.a).toBe(2).ok;
  });
});
