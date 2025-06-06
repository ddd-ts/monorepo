import { EventId, EventReference, IEsEvent } from "@ddd-ts/core";
import { Choice, Primitive, Shape } from "@ddd-ts/shape";

export class EventStatus extends Choice(["processing", "done", "failed"]) {}

export class Cursor extends Shape({
  occurredAt: Date,
  revision: Number,
  ref: EventReference,
  eventId: EventId,
}) {
  isAfterOrEqual(other: Cursor) {
    return this.is(other) || this.isAfter(other);
  }

  isAfter(other: Cursor) {
    if (this.occurredAt < other.occurredAt) {
      return false;
    }
    if (this.occurredAt > other.occurredAt) {
      return true;
    }
    if (this.revision < other.revision) {
      return false;
    }
    if (this.revision > other.revision) {
      return true;
    }
    return this.ref.serialize() > other.ref.serialize();
  }

  isBefore(other: Cursor) {
    return !this.isAfter(other);
  }

  is(other: Cursor) {
    return this.ref.serialize() === other.ref.serialize();
  }

  static from(event: IEsEvent) {
    return new Cursor({
      occurredAt: (event as any).occurredAt,
      revision: (event as any).revision,
      ref: (event as any).ref,
      eventId: event.id,
    });
  }

  toString() {
    return `${this.ref.serialize()}`;
  }
}

export class ProcessingStartedAt extends Primitive(Date) {
  timedOut(timeout: number) {
    return this.value.getTime() + timeout < Date.now();
  }
}
