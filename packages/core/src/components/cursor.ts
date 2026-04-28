import { MicrosecondTimestamp, Shape } from "@ddd-ts/shape";
import { EventId } from "./event-id";
import type { IFact } from "../interfaces/es-event";

export const CURSOR_MIN_REF = "<MIN>";
export const CURSOR_MAX_REF = "<MAX>";

export class Cursor extends Shape({
  ref: String,
  occurredAt: MicrosecondTimestamp,
  revision: Number,
  eventId: EventId,
}) {
  static MIN: Cursor;
  static MAX: Cursor;

  isMin() {
    return this.ref === CURSOR_MIN_REF;
  }

  isMax() {
    return this.ref === CURSOR_MAX_REF;
  }

  isSentinel() {
    return this.isMin() || this.isMax();
  }

  isAfter(other: Cursor): boolean {
    if (this.isMax()) {
      return !other.isMax();
    }
    if (other.isMax()) {
      return false;
    }
    if (this.isMin()) {
      return false;
    }
    if (other.isMin()) {
      return true;
    }

    if (this.is(other)) {
      return false;
    }

    if (this.occurredAt.isAfter(other.occurredAt)) {
      return true;
    }

    if (this.occurredAt.isBefore(other.occurredAt)) {
      return false;
    }

    if (this.revision > other.revision) {
      return true;
    }

    if (this.revision < other.revision) {
      return false;
    }

    if (typeof this.ref !== "string" || typeof other.ref !== "string") {
      throw new Error(
        `Cursor.isAfter: ref must be a string, got ${typeof this.ref} vs ${typeof other.ref}`,
      );
    }

    return this.ref > other.ref;
  }

  is(other: Cursor) {
    return this.ref === other.ref;
  }

  isOlderThan(microsecondTimestamp: MicrosecondTimestamp) {
    if (this.isMin()) {
      return true;
    }
    if (this.isMax()) {
      return false;
    }
    return this.occurredAt.isBefore(microsecondTimestamp);
  }

  static from(fact: IFact) {
    return new Cursor({
      ref: fact.ref,
      occurredAt: fact.occurredAt,
      revision: fact.revision,
      eventId: fact.id,
    });
  }

  toString() {
    return `${this.ref}`;
  }
}

Cursor.MIN = new Cursor({
  ref: CURSOR_MIN_REF,
  occurredAt: new MicrosecondTimestamp(BigInt(0)),
  revision: -1,
  eventId: new EventId(""),
});

Cursor.MAX = new Cursor({
  ref: CURSOR_MAX_REF,
  occurredAt: new MicrosecondTimestamp(
    BigInt(253402300799999) * BigInt(1000), // 9999-12-31T23:59:59.999Z in micros
  ),
  revision: -1,
  eventId: new EventId(""),
});
