import { Lock } from "./lock";

describe("Lock", () => {
  it("should create a lock with key-value pairs", () => {
    const lock = new Lock({ userId: "123", resourceId: "456" });
    expect(lock.get("userId")).toBe("123");
    expect(lock.get("resourceId")).toBe("456");
  });

  it("should check if lock has key", () => {
    const lock = new Lock({ userId: "123" });
    expect(lock.has("userId")).toBe(true);
    expect(lock.has("nonExistent")).toBe(false);
  });

  it("should determine lock restraint relationships", () => {
    const lock1 = new Lock({ userId: "123" });
    const lock2 = new Lock({ userId: "123", resourceId: "456" });

    // lock2 has more constraints, so it should be restrained by lock1
    expect(lock1.restrains(lock2)).toBe(true);
    expect(lock2.restrains(lock1)).toBe(true);
  });
});
