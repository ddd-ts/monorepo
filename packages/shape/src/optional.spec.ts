import { Optional, OptionalConfiguration } from "./optional";
import { Dict } from "./dict";
import { ex } from "./test";

describe("Optional", () => {
  it("class definition", () => {
    class Test extends Optional(String) {
      test = true as const;
    }

    type Serialized = string | undefined;

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize("a");
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<string | undefined>("a").ok;
    ex(
      a.match({
        some: (value) => value,
        none: () => "default",
      }),
    ).toBe("a").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>("a").ok;

    // Instantiation
    const b: Test = new Test(undefined);
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>(undefined).ok;
    ex(
      b.match({
        some: (value) => value,
        none: () => "default",
      }),
    ).toBe("default").ok;
  });

  it("inline definition", () => {
    class Test extends Dict({ longhand: Optional(String) }) {
      test = true as const;
    }

    type Serialized = { longhand: string | undefined };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ longhand: "a" });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.longhand).toStrictEqual<string | undefined>("a").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ longhand: "a" }).ok;

    // Instantiation
    const b: Test = new Test({ longhand: undefined });
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.longhand).toStrictEqual<string | undefined>(undefined).ok;
  });

  it("referenced definition", () => {
    class Reference extends Optional(String) {}
    class Test extends Dict({ reference: Reference }) {
      test = true as const;
    }

    type Serialized = { reference: string | undefined };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ reference: Reference }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ reference: "a" });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.reference).toStrictEqual<Reference>(new Reference("a")).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ reference: "a" }).ok;

    // Instantiation
    const b: Test = new Test({ reference: new Reference(undefined) });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.reference).toStrictEqual<Reference>(new Reference(undefined)).ok;
  });

  it("mixin extension", () => {
    const Testable = <const C extends OptionalConfiguration>(config: C) => {
      abstract class I extends Optional(config) {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return I;
    };

    class Test extends Testable(String) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = string | undefined;

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize("a");
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Serialized>("a").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>("a").ok;

    // Instantiation
    const b = new Test(undefined);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>(undefined).ok;
  });

  it("mixin supersede", () => {
    const Testable = <C extends OptionalConfiguration>(config: C) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Optional(config, I);
    };

    class Test extends Testable(String) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = string | undefined;

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize("a");
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Serialized>("a").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>("a").ok;

    // Instantiation
    const b = new Test(undefined);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>(undefined).ok;
  });
});
