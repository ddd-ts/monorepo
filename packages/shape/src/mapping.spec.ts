import { Dict } from "./dict";
import { Primitive } from "./primitive";
import { Mapping, type MappingConfiguration } from "./mapping";
import { ex } from "./test";

describe("Mapping", () => {
  it("class definition, specified key", () => {
    class Test extends Mapping([String, Primitive(Number)]) {
      test = true as const;
    }

    type Serialized = { [key: string]: number };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ key: 2 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Record<string, number>>({ key: 2 }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ key: 2 }).ok;

    // Instantiation
    const b: Test = new Test({ key: 2 });
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>({ key: 2 }).ok;
  });

  it("class definition, unspecified key", () => {
    class Test extends Mapping([Primitive(Number)]) {
      test = true as const;
    }

    type Serialized = { [key: string]: number };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ key: 2 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Record<string, number>>({ key: 2 }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ key: 2 }).ok;

    // Instantiation
    const b: Test = new Test({ key: 2 });
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>({ key: 2 }).ok;
  });

  it("inlined definition", () => {
    class Test extends Dict({
      longhand: Mapping([Primitive(Number)]),
      shorthand: Mapping([Number, { nested: String }]),
    }) {
      test = true as const;
    }

    type Serialized = {
      longhand: { [key: string]: number };
      shorthand: { [key: number]: { nested: string } };
    };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({
      longhand: { key: 2 },
      shorthand: { 0: { nested: "a" } },
    });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.longhand).toStrictEqual<Serialized["longhand"]>({ key: 2 }).ok;
    ex(a.shorthand).toStrictEqual<Serialized["shorthand"]>({
      0: { nested: "a" },
    }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({
      longhand: { key: 2 },
      shorthand: { 0: { nested: "a" } },
    }).ok;

    // Instantiation
    const b: Test = new Test({
      longhand: { key: 2 },
      shorthand: { 0: { nested: "a" } },
    });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.longhand).toStrictEqual<Serialized["longhand"]>({ key: 2 }).ok;
    ex(b.shorthand).toStrictEqual<Serialized["shorthand"]>({
      0: { nested: "a" },
    }).ok;
  });

  it("referenced definition", () => {
    class Reference extends Mapping([Number]) {}
    class Test extends Dict({ reference: Reference }) {
      test = true as const;
    }

    type Serialized = { reference: { [key: string]: number } };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ reference: Reference }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ reference: { 0: 1 } });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.reference).toStrictEqual<Reference>(new Reference({ 0: 1 })).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ reference: { 0: 1 } }).ok;

    // Instantiation
    const b: Test = new Test({ reference: new Reference({ 0: 1 }) });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.reference).toStrictEqual<Reference>(new Reference({ 0: 1 })).ok;
  });

  it("mixin extension", () => {
    const Testable = <const C extends MappingConfiguration>(config: C) => {
      abstract class I extends Mapping(config) {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return I;
    };

    class Test extends Testable([Number]) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = { [key: string]: number };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ key: 1 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Serialized>({ key: 1 }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ key: 1 }).ok;

    // Instantiation
    const b = new Test({ key: 2 });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>({ key: 2 }).ok;
  });

  it("mixin supersede", () => {
    const Testable = <C extends MappingConfiguration>(config: C) => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Mapping(config, I);
    };

    class Test extends Testable([Number]) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = { [key: string]: number };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ key: 1 });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Superseeded prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toStrictEqual<Serialized>({ key: 1 }).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ key: 1 }).ok;

    // Instantiation
    const b = new Test({ key: 2 });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Superseeded prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toStrictEqual<Serialized>({ key: 2 }).ok;
  });
});
