import { Shape } from "./_";
import { DeserializationError } from "./deserialization-error";

class Latitude extends Shape(Number) {
  static override deserialize(value: any): Latitude {
    if (typeof value !== "number") {
      throw new DeserializationError("Expected number", {
        rejectedValue: value,
        expected: "number",
      });
    }
    return new Latitude(value);
  }
}

class Address extends Shape({ latitude: Latitude }) {}
class User extends Shape({ address: Address }) {}
class Payload extends Shape({ user: User }) {}

describe("DeserializationError", () => {
  it("collects nested path on dict failure", () => {
    let caught: DeserializationError | undefined;
    try {
      Payload.deserialize({
        user: { address: { latitude: "not-a-number" as any } },
      } as any);
    } catch (err) {
      caught = err as DeserializationError;
    }

    expect(caught).toBeInstanceOf(DeserializationError);
    expect(caught!.path).toEqual(["user", "address", "latitude"]);
    expect(caught!.rejectedValue).toBe("not-a-number");
    expect(caught!.expected).toBe("number");
    expect(caught!.message).toContain("/user/address/latitude");
  });

  it("includes index segment for arrays", () => {
    class Latitudes extends Shape([Latitude]) {}

    let caught: DeserializationError | undefined;
    try {
      Latitudes.deserialize([1, 2, "bad" as any]);
    } catch (err) {
      caught = err as DeserializationError;
    }

    expect(caught).toBeInstanceOf(DeserializationError);
    expect(caught!.path).toEqual(["2"]);
    expect(caught!.rejectedValue).toBe("bad");
  });

  it("wrap() promotes plain errors and prepends segment", () => {
    const wrapped = DeserializationError.wrap(new Error("boom"), "field", 42);
    expect(wrapped.path).toEqual(["field"]);
    expect(wrapped.rejectedValue).toBe(42);
    expect(wrapped.message).toContain("boom");
  });
});
