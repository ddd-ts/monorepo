import { Lock } from "./lock";

describe("Lock", () => {
  it("should not restrain unrelated locks", () => {
    const lock1 = new Lock({ a: "1", b: "2" });
    const lock2 = new Lock({ c: "3", d: "4" });

    expect(lock1.restrains(lock2)).toBe(false);
    expect(lock2.restrains(lock1)).toBe(false);
  });

  it("should not restrain related locks with different values", () => {
    const lock1 = new Lock({ a: "1", b: "2" });
    const lock2 = new Lock({ a: "3", b: "4" });

    expect(lock1.restrains(lock2)).toBe(false);
    expect(lock2.restrains(lock1)).toBe(false);
  });

  it("should restrain related locks with same values", () => {
    const lock1 = new Lock({ a: "1", b: "2" });
    const lock2 = new Lock({ a: "1", b: "2" });

    expect(lock1.restrains(lock2)).toBe(true);
    expect(lock2.restrains(lock1)).toBe(true);
  });

  it("should restrain an included lock with additional keys", () => {
    const lock1 = new Lock({ a: "1", b: "2" });
    const lock2 = new Lock({ a: "1", b: "2", c: "3" });

    expect(lock1.restrains(lock2)).toBe(true);
  });

  it("should not restrain an included lock with less keys", () => {
    const lock1 = new Lock({ a: "1", b: "2", c: "3" });
    const lock2 = new Lock({ a: "1", b: "2" });

    expect(lock1.restrains(lock2)).toBe(false);
  });
});
