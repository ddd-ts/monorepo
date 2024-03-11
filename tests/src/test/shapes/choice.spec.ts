import { Choice, Dict } from "@ddd-ts/shape";
import { ex } from "./test";

describe("Choice", () => {
  it("class definition", () => {
    class Test extends Choice(["a", "b", "c"]) {
      test = true as const;
    }

    type Serialized = "a" | "b" | "c";

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize("a");
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe<"a" | "b" | "c">("a").ok;
    ex(
      a.match({
        a: () => 1 as const,
        b: () => 2 as const,
        _: () => 3 as const,
      }),
    ).toBe<1 | 2 | 3>(1).ok;
    ex(a.is("a")).toBe(true).ok;

    // Serialization
    ex(a.serialize()).toBe<"a" | "b" | "c">("a").ok;

    // Instantiation
    const b = new Test("a");
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe<"a" | "b" | "c">("a").ok;
    ex(
      a.match({
        a: () => 1 as const,
        b: () => 2 as const,
        _: () => 3 as const,
      }),
    ).toBe<1 | 2 | 3>(1).ok;
    ex(b.is("a")).toBe(true).ok;

    // Inherited statics
    ex(Test.a()).toBeInstanceOf(Test).ok;
    ex(Test.b()).toBeInstanceOf(Test).ok;
    ex(Test.c()).toBeInstanceOf(Test).ok;
  });

  it("inlined definition", () => {
    class Test extends Dict({ nested: Choice(["a", "b", "c"]) }) {}

    type Serialized = { nested: "a" | "b" | "c" };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ nested: "b" });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toBe<"a" | "b" | "c">("b").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<{ nested: "a" | "b" | "c" }>({
      nested: "b",
    }).ok;

    // Instantiation
    const e = new Test({ nested: "b" });
    ex(e).toBeInstanceOf(Test).ok;
  });

  it("referenced definition", () => {
    class Reference extends Choice(["a", "b", "c"]) {}
    class Test extends Dict({ nested: Reference }) {}

    type Serialized = { nested: "a" | "b" | "c" };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: Reference }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ nested: "a" });
    ex(a).toBeInstanceOf(Test);

    // Preserve reference
    ex(a.nested).toBeInstanceOf(Reference);
    ex(a.nested.is("a")).toBe(true);

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ nested: "a" });

    // Instantiation
    const b = new Test({ nested: new Reference("c") });
    expect(b).toBeInstanceOf(Test);
  });

  it("mixin extension are not supported", () => {
    const Mixin = <const S extends string[]>(choices: S) => {
      // @ts-expect-error https://github.com/microsoft/TypeScript/issues/57674
      abstract class Mix extends Choice(choices) {
        static d: "d";
      }

      return Mix as typeof Mix & { [K in S[number]]: K };
    };

    expect(true).toBe(true);
  });

  it("mixin supersede", () => {
    const Testable = <const S extends string[]>(choices: S) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Choice(choices, I);
    };

    class Test extends Testable(["a", "b", "c"]) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = "a" | "b" | "c";

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize("a");
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe<Serialized>("a").ok;
    ex(
      a.match({
        a: () => 1 as const,
        b: () => 2 as const,
        _: () => 3 as const,
      }),
    ).toBe<1 | 2 | 3>(1).ok;
    ex(a.is("a")).toBe(true).ok;

    // Serialization
    ex(a.serialize()).toBe<Serialized>("a").ok;

    // Instantiation
    const b = new Test("a");
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe<Serialized>("a").ok;
    ex(
      a.match({
        a: () => 1 as const,
        b: () => 2 as const,
        _: () => 3 as const,
      }),
    ).toBe<1 | 2 | 3>(1).ok;
    ex(b.is("a")).toBe(true).ok;

    // Inherited statics
    ex(Test.a()).toBeInstanceOf(Test).ok;
    ex(Test.b()).toBeInstanceOf(Test).ok;
    ex(Test.c()).toBeInstanceOf(Test).ok;

    // Additional inherited static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Additional inherited prototype
    ex(b.abstract).toBe(false as const).ok;
    ex(b.deep).toBe(true as const).ok;
  });
});
