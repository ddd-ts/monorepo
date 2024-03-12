import { Dict, Either, EitherConfiguration } from "@ddd-ts/shape";
import { ex } from "./test";

describe("Either", () => {
  it("class definition with two arguments", () => {
    class Test extends Either({ String, Number }) {
      test = true as const;
    }

    type Serialized = ["String", string] | ["Number", number];

    // Constructor parameters
    ex(Test).toHaveFirstParam<string | number>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize(["String", "test"]);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype
    ex(a.test).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe<string | number>("test").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(["String", "test"]).ok;

    // Instantiation
    const b = new Test("test");
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe<string | number>("test").ok;
  });

  it("class definition with constructors", () => {
    class A extends Dict({ a: String }) {}
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
    
    type Serialized = ["A", { a: string }] | ["B", { a: string }];

    // Constructor parameters
    ex(Test).toHaveFirstParam<A | B>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize(["A", { a: "test" }]);
    ex(a).toBeInstanceOf(Test).ok;
    const b = Test.deserialize(["B", { a: "test" }]);
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
    ex(a.serialize()).toStrictEqual<Serialized>(["A", { a: "test" }]).ok;
    ex(b.serialize()).toStrictEqual<Serialized>(["B", { a: "test" }]).ok;

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
    class Test extends Dict({ nested: Either({ String, Number }) }) {}

    type Serialized = { nested: ["String", string] | ["Number", number] };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: string | number }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ nested: ["String", "test"] });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toBe<string | number>("test").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ nested: ["String", "test"] })
      .ok;

    // Instantiation
    const b = new Test({ nested: "test" });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.nested).toBe<string | number>("test").ok;
  });

  it("referenced definition", () => {
    class A extends Either({ String, Number }) {}
    class Test extends Dict({ nested: A }) {}

    type Serialized = { nested: ["String", string] | ["Number", number] };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: A }>().ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a: Test = Test.deserialize({ nested: ["String", "test"] });
    ex(a).toBeInstanceOf(Test).ok;

    // Inherited prototype on deserialization
    ex(a.nested).toBeInstanceOf(A).ok;
    ex(a.nested.value).toBe<string | number>("test").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>({ nested: ["String", "test"] })
      .ok;

    // Instantiation
    const b: Test = new Test({ nested: new A("test") });
    ex(b).toBeInstanceOf(Test).ok;

    // Inherited prototype on instantiation
    ex(b.nested.value).toBe<string | number>("test").ok;
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

    class Test extends Mixin({ String, Number }) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    type Serialized = ["String", string] | ["Number", number];

    // Constructor parameters
    ex(Test).toHaveFirstParam<string | number>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize(["String", "test"]);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Extended prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe<string | number>("test").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(["String", "test"]).ok;

    // Instantiation
    const b = new Test("test");
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Extended prototype on instantiation
    ex(b.deep).toBe(true as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe<string | number>("test").ok;
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

    class Test extends Testable({ String, Number }) {
      test = true as const;

      // @ts-expect-error is not assignable to parameter of type 'true'
      abstract = false as const;
    }

    // Constructor type
    ex(Test).toHaveFirstParam<string | number>().ok;

    // Additional static prototype
    ex(Test.deep).toBe(true as const).ok;

    type Serialized = ["String", string] | ["Number", number];

    // Deserialization
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize(["String", "test"]);
    ex(a).toBeInstanceOf(Test).ok;

    // Additional prototype on deserialization
    ex(a.test).toBe(true as const).ok;
    ex(a.abstract).toBe(false as const).ok;

    // Superseded prototype on deserialization
    ex(a.deep).toBe(true as const).ok;

    // Inherited prototype on deserialization
    ex(a.value).toBe<string | number>("test").ok;

    // Serialization
    ex(a.serialize()).toStrictEqual<Serialized>(["String", "test"]).ok;

    // Instantiation
    const b = new Test(2);
    ex(b).toBeInstanceOf(Test).ok;

    // Additional prototype on instantiation
    ex(b.test).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Superseded prototype on instantiation
    ex(b.deep).toBe(true as const).ok;
    ex(b.abstract).toBe(false as const).ok;

    // Inherited prototype on instantiation
    ex(b.value).toBe<string | number>(2).ok;
  });
});
