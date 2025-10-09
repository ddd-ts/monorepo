import { MicrosecondTimestamp, Shape } from "@ddd-ts/shape";
import { EventId } from "./event-id";
import { IFact } from "../interfaces/es-event";

export class Cursor extends Shape({
  ref: String,
  occurredAt: MicrosecondTimestamp,
  revision: Number,
  eventId: EventId,
}) {
  isAfterOrEqual(other: Cursor) {
    if (this.is(other)) {
      return true;
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

    return this.ref >= other.ref;
  }

  is(other: Cursor) {
    return this.ref === other.ref;
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
