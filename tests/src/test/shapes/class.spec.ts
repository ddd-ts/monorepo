import { Class, Dict } from "@ddd-ts/shape";
import { ex } from "./test";

describe("Class", () => {
  it("inline definition", () => {
    class A {
      serialize() {
        return "a";
      }

      static deserialize(value: string) {
        return new A();
      }
    }

    class Test extends Dict({
      nested: Class(A),
    }) {
      test = true as const;
    }

    type Serialized = { nested: string };

    // Constructor parameters
    ex(Test).toHaveFirstParam<{ nested: A }>().ok;

    // Deserializes to self
    ex(Test.deserialize).toHaveFirstParam<Serialized>().ok;
    const a = Test.deserialize({ nested: "a" });
    ex(a).toBeInstanceOf(Test).ok;

    // Property is still there
    const b = a.test;
    ex(b).toBe(true as const).ok;

    // Serializes to a precise type
    ex(a.serialize()).toStrictEqual({ nested: "a" }).ok;

    // Shape is still there
    ex(a.nested.serialize()).toBe("a").ok;

    // Instantiates with a precise type
    const e = new Test({ nested: new A() });
    ex(e).toBeInstanceOf(Test).ok;
  });
});
