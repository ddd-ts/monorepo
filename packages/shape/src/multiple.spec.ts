import { Multiple, MultipleConfiguration } from "./multiple";
import { Dict } from "./dict";
import { ex } from "./test";
import { Expand, DefinitionOf } from "./_";

describe("Multiple", () => {
  it("class definition", () => {
    class Test extends Multiple(String) {
      test = true as const;
    }

    type Serialized = string[];

    // Constructor parameters
    ex(Test).toHaveFirstParam<string[]>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize(["a"]);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<string[]>(["a"]).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(["a"]).ok;

    // Instantiation
    const b: Test = new Test(["b"]);
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<string[]>(["b"]).ok;
    ex([...b.values()]).toStrictEqual<string[]>(["b"]).ok;
    ex([...b.entries()]).toStrictEqual<[number, string][]>([[0, "b"]]).ok;
    ex([...b.keys()]).toStrictEqual<number[]>([0]).ok;
    ex(b.filter(() => true)).toStrictEqual<string[]>(["b"]).ok;
    ex(b.map((x) => x.charCodeAt(0))).toStrictEqual<number[]>([98]).ok;
    ex(b.reduce((a, b) => a + b)).toStrictEqual<string>("b").ok;
    ex(b.some((x) => x === "b")).toBe(true).ok;
    ex(b.every((x) => x === "b")).toBe(true).ok;
    ex(b.find((x) => x === "b")).toStrictEqual<string | undefined>("b").ok;
    ex(b.findIndex((x) => x === "b")).toStrictEqual<number>(0).ok;
    ex(b.includes("b")).toBe(true).ok;
    ex(b.indexOf("b")).toStrictEqual<number>(0).ok;
    ex(b.lastIndexOf("b")).toStrictEqual<number>(0).ok;
  });

  it("inline definition", () => {
    class Test extends Dict({
      longhand: Multiple(String),
      shorthand: [{ nested: Number }],
    }) {
      test = true as const;
    }

    type Serialized = {
      longhand: string[];
      shorthand: { nested: number }[];
    };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({
      longhand: ["a"],
      shorthand: [{ nested: 0 }],
    });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.longhand).toStrictEqual<Serialized["longhand"]>(["a"]).ok;
    ex(a.shorthand).toStrictEqual<Serialized["shorthand"]>([{ nested: 0 }]).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({
      longhand: ["a"],
      shorthand: [{ nested: 0 }],
    }).ok;

    // Instantiation
    const b: Test = new Test({
      longhand: ["b"],
      shorthand: [{ nested: 1 }],
    });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.longhand).toStrictEqual<Serialized["longhand"]>(["b"]).ok;
    ex(b.shorthand).toStrictEqual<Serialized["shorthand"]>([{ nested: 1 }]).ok;
  });

  it("referenced definition", () => {
    class Reference extends Multiple(Number) {}
    class Test extends Dict({ reference: Reference }) {
      test = true as const;
    }

    type Serialized = { reference: number[] };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ reference: Reference }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ reference: [0] });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.reference).toStrictEqual<Reference>(new Reference([0])).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ reference: [0] }).ok;

    // Instantiation
    const b: Test = new Test({ reference: new Reference([0]) });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.reference).toStrictEqual<Reference>(new Reference([0])).ok;

    // Inherited prototype on instantiation
    ex(b.reference.value).toStrictEqual([0]).ok;
    ex([...b.reference.values()]).toStrictEqual([0]).ok;
    ex([...b.reference.entries()]).toStrictEqual<[number, number][]>([[0, 0]])
      .ok;
    ex([...b.reference.keys()]).toStrictEqual([0]).ok;
    ex(b.reference.filter(() => true)).toStrictEqual([0]).ok;
    ex(b.reference.map((x) => String(x))).toStrictEqual(["0"]).ok;
    ex(b.reference.reduce((a, b) => a + b)).toStrictEqual(0).ok;
    ex(b.reference.some((x) => x === 0)).toBe(true).ok;
    ex(b.reference.every((x) => x === 0)).toBe(true).ok;
    ex(b.reference.find((x) => x === 0)).toStrictEqual<number | undefined>(0)
      .ok;
    ex(b.reference.findIndex((x) => x === 0)).toStrictEqual(0).ok;
    ex(b.reference.includes(0)).toBe(true).ok;
    ex(b.reference.indexOf(0)).toStrictEqual(0).ok;
    ex(b.reference.lastIndexOf(0)).toStrictEqual(0).ok;
  });

  it("mixin extension", () => {
    const Testable = <const C extends MultipleConfiguration>(config: C) => {
      abstract class I extends Multiple(config) {
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

    type Serialized = number[];

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize([0]);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Serialized>([0]).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>([0]).ok;

    // Instantiation
    const b = new Test([1]);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>([1]).ok;
  });

  it("mixin supersede", () => {
    const Testable = <C extends MultipleConfiguration>(config: C) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Multiple(config, I);
    };

    class Test extends Testable(Number) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }
    type Serialized = number[];

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize([0]);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Serialized>([0]).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>([0]).ok;

    // Instantiation
    const b = new Test([1]);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>([1]).ok;
  });
});
