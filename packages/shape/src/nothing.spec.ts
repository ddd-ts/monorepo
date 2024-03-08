import { Nothing } from "./nothing";
import { Dict } from "./dict";
import { ex } from "./test";

describe("Nothing", () => {
  it("class definition", () => {
    class Test extends Nothing() {
      test = true as const;
    }

    type Serialized = void;

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize();
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    // none

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(undefined).ok;

    // Instantiation
    const b: Test = new Test();
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    // none
  });

  it("inline definition", () => {
    class Test extends Dict({
      longhand: Nothing(),
      shorthand: undefined,
    }) {
      test = true as const;
    }

    type Serialized = { longhand: void; shorthand: void };

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ longhand: undefined, shorthand: undefined });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.longhand).toStrictEqual<void>(undefined).ok;
    ex(a.shorthand).toStrictEqual<void>(undefined).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({
      longhand: undefined,
      shorthand: undefined,
    }).ok;

    // Instantiation
    const b: Test = new Test({ longhand: undefined, shorthand: undefined });
    ex(b).toBeInstanceOf(Test);

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.longhand).toStrictEqual<void>(undefined).ok;
    ex(b.shorthand).toStrictEqual<void>(undefined).ok;
  });

  it("referenced definition", () => {
    class Reference extends Nothing() {}
    class Test extends Dict({ reference: Reference }) {
      test = true as const;
    }

    type Serialized = { reference: void };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ reference: Reference }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ reference: undefined });
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.reference).toStrictEqual<Reference>(new Reference()).ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ reference: undefined }).ok;

    // Instantiation
    const b: Test = new Test({ reference: new Reference() });
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.reference).toStrictEqual<Reference>(new Reference()).ok;
  });

  it("mixin extension", () => {
    const Testable = () => {
      abstract class I extends Nothing() {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return I;
    };

    class Test extends Testable() {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = void;

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize();
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    // none

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(undefined).ok;

    // Instantiation
    const b = new Test();
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    // none
  });

  it("mixin supersede", () => {
    const Testable = () => {
      abstract class I {
        deep = true as const;
        static deep = true as const;

        abstract abstract: true;
      }

      return Nothing(undefined, I);
    };

    class Test extends Testable() {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = void;

    // Constructor parameters
    ex(Test).toHaveFirstParam<Serialized>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize();
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    // none

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(undefined).ok;

    // Instantiation
    const b = new Test();
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    // none
  });
});
