import { EventId, EventReference, IEsEvent } from "@ddd-ts/core";
import {
  Choice,
  Multiple,
  Optional,
  Primitive,
  Shape,
} from "../../../shape/dist";
import { IdMap } from "../idmap";
import { Lock } from "./lock";

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

export class Thread extends Shape({
  head: Optional(Cursor),
  tasks: Multiple({
    cursor: Cursor,
    lock: Lock,
    timeout: Optional(Number),
    enqueuedAt: Date,
  }),
  statuses: IdMap(EventId, EventStatus),
  processingStartedAt: IdMap(EventId, ProcessingStartedAt),
}) {
  enqueue(cursor: Cursor, lock: Lock, timeout?: number) {
    if (this.head?.isAfterOrEqual(cursor)) {
      return;
    }
    this.tasks.push({ cursor, lock, timeout, enqueuedAt: new Date() });
    this.head = cursor;
  }

  clean() {
    for (const task of [...this.tasks]) {
      const status = this.statuses.get(task.cursor.eventId);
      const processingStartedAt = this.processingStartedAt.get(
        task.cursor.eventId,
      );

      if (processingStartedAt?.timedOut(task.timeout ?? 120_000)) {
        this.tasks.shift();
        this.statuses.delete(task.cursor.eventId);
        this.processingStartedAt.delete(task.cursor.eventId);
        console.log(
          `Thread: Task for event ${task.cursor.eventId.serialize()} timed out and was removed.`,
        );
        continue;
      }

      if (!status?.is("done")) {
        return;
      }

      this.tasks.shift();
      this.statuses.delete(task.cursor.eventId);
      this.processingStartedAt.delete(task.cursor.eventId);
    }
  }

  startNextBatch() {
    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];
    const batch: Cursor[] = [];

    for (const task of [...this.tasks]) {
      if (locks.some((lock) => lock.restrains(task.lock))) {
        // TODO: ADD TEST FOR JUSTIFYING THIS
        locks.push(task.lock);
        continue;
      }

      if (batchLocks.some((lock) => lock.restrains(task.lock, false))) {
        locks.push(task.lock);
        continue;
      }

      const status = this.statuses.get(task.cursor.eventId);
      if (status?.is("processing") || status?.is("done")) {
        locks.push(task.lock);
        continue;
      }

      batch.push(task.cursor);
      batchLocks.push(task.lock);

      this.statuses.set(task.cursor.eventId, EventStatus.processing());
      this.processingStartedAt.set(
        task.cursor.eventId,
        new ProcessingStartedAt(new Date()),
      );
    }

    return batch;
  }

  toString() {
    return [
      "",
      `HEAD: ${this.head}`,
      ...this.tasks.map(
        (task) =>
          `\t${task.cursor.ref.serialize()} ${this.statuses.get(task.cursor.eventId)?.serialize()}`,
      ),
      "",
    ].join("\n");
  }
}
