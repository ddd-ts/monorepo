import { Shape } from "@ddd-ts/shape";
import { AutoSerializer } from "./auto-serializer";
import { SerializerRegistry } from "./serializer-registry";
import { Derive } from "@ddd-ts/traits";
import { NamedShape } from "../traits/shaped";

describe("SerializerRegistry", () => {
  it("serializes and deserializes", async () => {
    class Timespan extends Shape({
      start: Date,
      end: Date,
    }) {
      access() {
        this.start.toISOString();
        this.end.toISOString();
      }
    }

    class MyClass extends Derive(
      NamedShape("MyClass", {
        name: String,
        timespan: Timespan,
      }),
    ) {
      access() {
        this.name.toString();
        this.timespan.access();
      }
    }

    const now = new Date();
    const timespan = new Timespan({ start: now, end: now });
    const myClass = new MyClass({ name: "super name", timespan });

    class MyClassSerializer extends AutoSerializer(MyClass, 1) {}

    const registry = new SerializerRegistry().add(
      MyClass,
      new MyClassSerializer(),
    );

    const serialized = await registry.serialize(myClass);

    expect(serialized).toEqual({
      version: 1,
      $name: "MyClass",
      name: "super name",
      timespan: {
        start: now,
        end: now,
      },
    });

    const deserialized = await registry.deserialize(serialized);

    deserialized.access();

    expect(deserialized).toBeInstanceOf(MyClass);
  });
});
