import { EventId, EventReference, IEsEvent } from "@ddd-ts/core";
import { Choice, Multiple, Optional, Shape } from "../../../shape/dist";
import { IdMap } from "../idmap";
import { Lock } from "./lock";

export class EventStatus extends Choice(["processing", "done"]) {}

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

export class Thread extends Shape({
  tail: Optional(Cursor),
  head: Optional(Cursor),
  tasks: Multiple({
    cursor: Cursor,
    lock: Lock,
    previous: Optional(EventId),
  }),
  statuses: IdMap(EventId, EventStatus),
}) {
  enqueue(cursor: Cursor, lock: Lock, previous?: EventId) {
    const head = this.head;

    if (head?.isAfterOrEqual(cursor)) {
      return;
    }

    if (!previous) {
      if (head) {
        // hitting this when processing an event that was already processed.
        // Can this happen when used through a projector ?
        return;
      }

      this.tasks.push({
        cursor,
        lock,
        previous: undefined,
      });
      this.head = cursor;
      return;
    }

    if (!head) {
      throw new Error("Previous event is required when queue is not empty");
    }

    if (!head.eventId.equals(previous)) {
      throw new Error(
        `Previous event ${previous.serialize()} does not match last cursor ${head.eventId.serialize()}`,
      );
    }

    this.tasks.push({ cursor, lock, previous });
    this.head = cursor;
  }

  process(eventId: EventId) {
    const claim = this.tasks.find((c) => c.cursor.eventId.equals(eventId));
    if (!claim) {
      throw new Error(`Event not found in thread: ${eventId}`);
    }
    this.statuses.set(eventId, EventStatus.processing());
  }

  processed(eventId: EventId) {
    const claim = this.tasks.find((c) => c.cursor.eventId.equals(eventId));
    if (!claim) {
      throw new Error(`Event not found in thread: ${eventId}`);
    }

    this.statuses.set(eventId, EventStatus.done());
    this.clean();
  }

  clean() {
    for (const task of [...this.tasks]) {
      const status = this.statuses.get(task.cursor.eventId);
      if (!status?.is("done")) {
        return;
      }
      this.tail = this.tasks.shift()?.cursor;
    }
  }

  startNextBatch() {
    const locks: Lock[] = [];
    const batch: Cursor[] = [];

    for (const task of this.tasks) {
      if (locks.some((lock) => lock.restrains(task.lock))) {
        continue;
      }
      locks.push(task.lock);

      const status = this.statuses.get(task.cursor.eventId);
      if (status) continue;

      batch.push(task.cursor);
      this.statuses.set(task.cursor.eventId, EventStatus.processing());
    }

    return batch;
  }

  toString() {
    return [
      `\tHEAD: ${this.head}`,
      ...this.tasks.map(
        (task) =>
          `\t\t${task.cursor.ref.serialize()} ${this.statuses.get(task.cursor.eventId)?.serialize()}`,
      ),
      `\tTAIL: ${this.tail}`,
    ].join("\n");
  }
}
