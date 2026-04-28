import { MicrosecondTimestamp } from "@ddd-ts/shape";
import { Cursor } from "./cursor";
import { EventId } from "./event-id";

const realCursor = (overrides: Partial<{ ref: string; micros: bigint; revision: number; eventId: string }> = {}) =>
  new Cursor({
    ref: overrides.ref ?? "event-store/Account/streams/abc/events/1",
    occurredAt: new MicrosecondTimestamp(overrides.micros ?? BigInt(1_000_000_000_000_000)),
    revision: overrides.revision ?? 1,
    eventId: new EventId(overrides.eventId ?? "evt-1"),
  });

describe("Cursor sentinels", () => {
  it("MIN is never after a real cursor", () => {
    const c = realCursor();
    expect(Cursor.MIN.isAfter(c)).toBe(false);
  });

  it("a real cursor is always after MIN", () => {
    const c = realCursor();
    expect(c.isAfter(Cursor.MIN)).toBe(true);
  });

  it("MAX is always after a real cursor", () => {
    const c = realCursor();
    expect(Cursor.MAX.isAfter(c)).toBe(true);
  });

  it("a real cursor is never after MAX", () => {
    const c = realCursor();
    expect(c.isAfter(Cursor.MAX)).toBe(false);
  });

  it("MAX is after MIN", () => {
    expect(Cursor.MAX.isAfter(Cursor.MIN)).toBe(true);
    expect(Cursor.MIN.isAfter(Cursor.MAX)).toBe(false);
  });

  it("MIN is not after MIN; MAX is not after MAX", () => {
    expect(Cursor.MIN.isAfter(Cursor.MIN)).toBe(false);
    expect(Cursor.MAX.isAfter(Cursor.MAX)).toBe(false);
  });

  it("identifies sentinels", () => {
    expect(Cursor.MIN.isMin()).toBe(true);
    expect(Cursor.MAX.isMax()).toBe(true);
    expect(Cursor.MIN.isSentinel()).toBe(true);
    expect(Cursor.MAX.isSentinel()).toBe(true);

    const c = realCursor();
    expect(c.isMin()).toBe(false);
    expect(c.isMax()).toBe(false);
    expect(c.isSentinel()).toBe(false);
  });

  it("isOlderThan: MIN is older than any timestamp; MAX is never older", () => {
    const ts = MicrosecondTimestamp.now();
    expect(Cursor.MIN.isOlderThan(ts)).toBe(true);
    expect(Cursor.MAX.isOlderThan(ts)).toBe(false);
  });
});
