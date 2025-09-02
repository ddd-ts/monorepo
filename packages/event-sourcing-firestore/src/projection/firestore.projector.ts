import {
  FieldValue,
  Firestore,
  Timestamp,
  WriteBatch,
} from "firebase-admin/firestore";
import {
  IEsEvent,
  ISavedChange,
  EventId,
  ProjectedStreamReader,
  Cursor,
  CheckpointId,
  ESProjection,
  ProjectedStream,
  IFact,
  Serialized,
  Lock,
  buffer,
} from "@ddd-ts/core";
import { MicrosecondTimestamp, Optional, Shape } from "@ddd-ts/shape";
import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
// import { Trace } from "./trace.decorator";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function* batched<T>(iterable: AsyncIterable<T>, batchSize = 100) {
  let batch: T[] = [];
  for await (const item of iterable) {
    batch.push(item);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield batch;
  }
}

export class FirestoreProjector {
  _unclaim = true;

  constructor(
    public readonly projection: ESProjection<IEsEvent>,
    public readonly reader: ProjectedStreamReader<IEsEvent>,
    public readonly queue: FirestoreQueueStore,
    public config = {
      retry: { attempts: 20, minDelay: 10, maxDelay: 1000 },
      enqueue: { batchSize: 100 },
      onProcessError: (error: Error) => {
        console.error("Error processing event:", error);
      },
      onEnqueueError: (error: Error) => {
        console.error("Error enqueuing tasks:", error);
      },
    },
  ) {}

  async *breathe() {
    for (let i = 0; i < this.config.retry.attempts; i++) {
      yield i;

      const margin = this.config.retry.maxDelay - this.config.retry.minDelay;
      const jitter = Math.random() * margin;
      const jitteredDelay = this.config.retry.minDelay + jitter;
      await wait(jitteredDelay);
    }
  }

  // @Trace("projector.handle", ($, e) => ({
  //   eventId: e.id.serialize(),
  //   eventName: e.name,
  //   eventRevision: e.revision,
  //   eventReference: e.ref,
  //   projectionName: $.projection.constructor.name,
  //   checkpointId: $.projection.getCheckpointId(e).serialize(),
  // }))
  async handle(savedChange: ISavedChange<IEsEvent>) {
    const checkpointId = this.projection.getCheckpointId(savedChange);
    const target = await this.getCursor(savedChange);

    if (!target) {
      throw new Error(
        `Cursor not found for event ${savedChange.id.serialize()}`,
      );
    }

    const errors = [];

    for await (const attempt of this.breathe()) {
      const source = this.projection.getSource(savedChange);
      const [ok, message] = await this.attempt(source, checkpointId, target);

      if (ok) {
        await this.queue.cleanup(checkpointId);
        return;
      }

      errors.push(message);
    }

    throw new Error(
      `Failed to handle event ${savedChange.id.serialize()}: ${errors.join(", ")}`,
    );
  }

  // @Trace("projector.reader.getCursor")
  private async getCursor(savedChange: ISavedChange<IEsEvent>) {
    return await this.reader.getCursor(savedChange);
  }

  // @Trace("projector.attempt")
  private async attempt(
    source: ProjectedStream,
    checkpointId: CheckpointId,
    target: Cursor,
  ) {
    const headCursor = await this.getQueueHead(checkpointId);

    if (!headCursor?.isAfterOrEqual(target)) {
      const [ok, message] = await this.enqueue(source, checkpointId, target);
      if (!ok) {
        return [false, message] as const;
      }
    }

    if (await this.checkIsProcessed(checkpointId, target)) {
      return [true, "Successfully processed"] as const;
    }

    const unprocessed = await this.getUnprocessed(checkpointId);

    if (!unprocessed.length) {
      return [false, "No unprocessed tasks found"] as const;
    }

    const batch = Task.batch(unprocessed);
    const claimer = ClaimerId.generate();

    const [ok, message] = await this.claimTasks(checkpointId, claimer, batch);

    if (!ok) {
      return [false, message] as const;
    }

    return await this.processEvents(checkpointId, claimer, target.eventId);
  }

  // @Trace("projector.queue.head")
  private async getQueueHead(checkpointId: CheckpointId) {
    return await this.queue.head(checkpointId);
  }

  // @Trace("projector.readSourceStream")
  private async readSourceStream(
    source: ProjectedStream,
    checkpointId: CheckpointId,
    target: Cursor,
  ) {
    const shard = checkpointId.shard();
    const headCursor = await this.getQueueHead(checkpointId);
    const limit = this.config.enqueue.batchSize;
    return this.reader.slice(source, shard, headCursor, target, limit);
  }

  // @Trace("projector.enqueue")
  private async enqueue(
    source: ProjectedStream,
    checkpointId: CheckpointId,
    target: Cursor,
  ) {
    const events = await this.readSourceStream(source, checkpointId, target);

    const tasks = events.map((e) => {
      const settings = this.projection.getTaskSettings(e);
      return Task.new(e, settings);
    });

    return await this.queue.enqueue(checkpointId, tasks);
  }

  // @Trace("projector.queue.isProcessed")
  private async checkIsProcessed(checkpointId: CheckpointId, cursor: Cursor) {
    return await this.queue.isProcessed(checkpointId, cursor);
  }

  // @Trace("projector.queue.unprocessed")
  private async getUnprocessed(checkpointId: CheckpointId) {
    return await this.queue.unprocessed(checkpointId);
  }

  // @Trace("projector.queue.claim")
  private async claimTasks(
    checkpointId: CheckpointId,
    claimer: ClaimerId,
    batch: Task<true>[],
  ) {
    try {
      await this.queue.claim(checkpointId, claimer, batch);
      return [true, "Tasks claimed successfully"] as const;
    } catch (e) {
      return [false, e] as const;
    }
  }

  // @Trace("projector.processEvents")
  private async processEvents(
    checkpointId: CheckpointId,
    claimer: ClaimerId,
    targetEventId: EventId,
  ) {
    const tasks = await this.queue.claimed(checkpointId, claimer);
    const todo = await Promise.all(tasks.map((t) => this.reader.get(t.cursor)));
    const filtered = todo.filter((t) => !!t) as IEsEvent[];

    const onProcessed = this.queue.processed.bind(this.queue);
    const context = { onProcessed, checkpointId };

    try {
      const processed = await this.projection.process(filtered, context);

      if (processed.some((id) => id?.equals(targetEventId))) {
        return [true, "Target event processed successfully"] as const;
      }

      return [false, "Target event not processed yet"] as const;
    } catch (e) {
      this.config.onProcessError(e as Error);
      if (this._unclaim) {
        await this.queue.unclaim(checkpointId, tasks);
      }
      return [false, e] as const;
    }
  }
}

export class AlreadyEnqueuedError extends Error {
  constructor() {
    super("Tasks already enqueued");
    this.name = "AlreadyEnqueuedError";
  }
}

export class FirestoreQueueStore {
  converter = new DefaultConverter();
  collection: FirebaseFirestore.CollectionReference;

  constructor(public db: Firestore) {
    this.collection = db.collection(
      "projection",
    ) as FirebaseFirestore.CollectionReference;
  }

  private timestampToMicroseconds(timestamp: Timestamp): MicrosecondTimestamp {
    const microseconds =
      BigInt(timestamp.seconds) * BigInt(1_000_000) +
      BigInt(timestamp.nanoseconds) / BigInt(1_000);
    return new MicrosecondTimestamp(microseconds);
  }

  private microsecondsToTimestamp(
    microseconds: MicrosecondTimestamp,
  ): Timestamp {
    const seconds = BigInt(microseconds.micros) / 1_000_000n;
    const nanoseconds = (BigInt(microseconds.micros) % 1_000_000n) * 1000n; // Convert to nanoseconds
    return new Timestamp(Number(seconds), Number(nanoseconds));
  }

  async enqueue(checkpointId: CheckpointId, tasks: Task<false>[]) {
    const batch = this.collection.firestore.batch();

    for (const task of tasks) {
      const ref = this.queued(checkpointId, task.id);
      batch.create(ref, {
        ref: this.db.doc(task.cursor.ref),
        ...this.converter.toFirestore(task.serialize()),
      });
    }

    try {
      await batch.commit();
      return [true, "Tasks enqueued successfully"] as const;
    } catch (err: any) {
      if (err.code === 6) {
        return [false, new AlreadyEnqueuedError()] as const;
      }
      return [false, err] as const;
    }
  }

  async claim(
    checkpointId: CheckpointId,
    claimer: ClaimerId,
    tasks: Task<true>[],
  ) {
    const batch = this.collection.firestore.batch();

    for (const task of tasks) {
      const ref = this.queued(checkpointId, task.id);
      batch.update(
        ref,
        {
          claimer: claimer.serialize(),
          claimedAt: FieldValue.serverTimestamp(),
          attempts: FieldValue.increment(1),
        },
        { lastUpdateTime: this.microsecondsToTimestamp(task.lastUpdateTime) },
      );
    }

    await batch.commit();
  }

  async head(checkpointId: CheckpointId) {
    const head = this.queue(checkpointId)
      .where("skipped", "==", false)
      .orderBy("occurredAt", "desc")
      .orderBy("revision", "desc")
      .limit(1);
    const headDoc = (await head.get()).docs[0];
    if (!headDoc) {
      return undefined;
    }

    const headData = this.converter.fromFirestoreSnapshot(headDoc);
    if (!headData) {
      return undefined;
    }
    const headCursor = headDoc
      ? Cursor.deserialize({
          ref: headData.ref,
          occurredAt: headData.occurredAt,
          revision: headData.revision,
          eventId: headData.id,
        })
      : undefined;
    return headCursor;
  }

  async unprocessed(checkpointId: CheckpointId) {
    const query = this.queue(checkpointId)
      .where("processed", "==", false)
      .where("skipped", "==", false)
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc");

    const snapshot = await query.get();
    const tasks = snapshot.docs.map((doc) => {
      const data = this.converter.fromFirestoreSnapshot(doc);
      const timestamp = doc.updateTime
        ? this.timestampToMicroseconds(doc.updateTime)
        : undefined;
      return Task.deserializeWithLastUpdateTime(data as any, timestamp);
    });

    // Check for timeouts and unclaim expired tasks
    const expiredTasks: Task<true>[] = [];
    for (const task of tasks) {
      const originalClaimer = task.claimer;
      task.checkTimeout();

      // If timeout cleared the claimer, we need to update the database
      if (originalClaimer && !task.claimer) {
        expiredTasks.push(task);
      }
    }

    // Update expired tasks in the database
    if (expiredTasks.length > 0) {
      const batch = this.collection.firestore.batch();
      for (const task of expiredTasks) {
        const ref = this.queued(checkpointId, task.id);
        batch.update(ref, {
          claimer: FieldValue.delete(),
          claimedAt: FieldValue.delete(),
          attempts: task.attempts,
          skipped: task.skipped,
        });
      }
      await batch.commit();
    }

    return tasks;
  }

  async claimed(
    checkpointId: CheckpointId,
    claimer: ClaimerId,
  ): Promise<Task<true>[]> {
    const query = this.queue(checkpointId)
      .where("claimer", "==", claimer.serialize())
      .where("skipped", "==", false)
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc");

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => {
      const data = this.converter.fromFirestoreSnapshot(doc);
      const timestamp = doc.updateTime
        ? this.timestampToMicroseconds(doc.updateTime as Timestamp)
        : undefined;
      return Task.deserializeWithLastUpdateTime(data as any, timestamp);
    });
  }

  async unclaim(checkpointId: CheckpointId, tasks: Task<true>[]) {
    const batch = this.collection.firestore.batch();

    for (const task of tasks) {
      const ref = this.queued(checkpointId, task.id);
      batch.update(ref, {
        claimer: FieldValue.delete(),
        claimedAt: FieldValue.delete(),
      });
    }

    await batch.commit();
  }
  async isProcessed(checkpointId: CheckpointId, cursor: Cursor) {
    const doc = await this.queued(checkpointId, cursor.eventId).get();
    if (doc.exists) {
      const data = doc.data();
      if (!data) return false;
      if (data.processed === true) return true;
      return false;
    }

    const tail = await this.getTailCursor(checkpointId);
    if (tail?.isAfterOrEqual(cursor)) return true;

    return false;
  }

  checkpoint(id: CheckpointId) {
    return this.collection.doc(id.serialize());
  }

  queue(id: CheckpointId) {
    return this.checkpoint(id).collection("queue");
  }

  queued(id: CheckpointId, eventId: EventId) {
    return this.queue(id).doc(eventId.serialize());
  }

  async processed(
    id: CheckpointId,
    eventIds: EventId[],
    context: {
      transaction?: FirestoreTransaction;
      batchWriter?: WriteBatch;
    } = {},
  ) {
    const { transaction: trx, batchWriter } = context;

    if (trx) {
      for (const eventId of eventIds) {
        const ref = this.queued(id, eventId);
        trx.transaction.update(ref, { processed: true });
      }
      return;
    }

    await Promise.all(
      eventIds.map((eventId) =>
        this.queued(id, eventId).update({
          processed: true,
        }),
      ),
    );

    return;
  }

  async getTailCursor(id: CheckpointId) {
    const tail = this.queue(id)
      .where("skipped", "==", false)
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc")
      .limit(1);
    const tailDoc = (await tail.get()).docs[0];
    if (!tailDoc) {
      return undefined;
    }

    const tailData = this.converter.fromFirestoreSnapshot(tailDoc);
    if (!tailData) {
      return undefined;
    }
    const tailCursor = tailDoc
      ? Cursor.deserialize({
          ref: tailData.ref,
          occurredAt: tailData.occurredAt,
          revision: tailData.revision,
          eventId: tailData.id,
        })
      : undefined;
    return tailCursor;
  }

  async cleanup(id: CheckpointId) {
    const query = this.queue(id)
      .where("skipped", "==", false)
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc");

    const MIN_TRAIL = 1; // Keep at least one processed document to maintain the tail cursor
    const TRAIL = MIN_TRAIL + 30; // Extra buffer to optimize isProcessed checks

    const snapshot = await query.get();

    if (snapshot.size < TRAIL) return;

    const stopper = snapshot.docs.findIndex((doc) => !doc.data().processed);
    const cleanable = snapshot.docs.slice(0, stopper);

    const cleaning = cleanable.slice(0, cleanable.length - TRAIL);
    if (cleaning.length === 0) return;

    const batch = this.collection.firestore.batch();
    for (const queued of cleaning) batch.delete(queued.ref);
    await batch.commit();
  }

  async flush(id: CheckpointId) {
    const stream = this.queue(id).stream() as AsyncIterable<any>;
    const writer = this.collection.firestore.bulkWriter();
    for await (const queued of stream) writer.delete(queued.ref);
    await writer.close();
  }

  /**
   * This method adds a fake processed event to the queue.
   * It is useful for initializing the tail cursor of a new projection, at the
   * same time as the projection's initial state is created, reset, or updated.
   * By default, it will use the current time as the occurredAt timestamp.
   * You can override this by providing a specific timestamp.
   *
   * This ensures that the projection can start processing new events from the
   * correct point in time, avoiding reprocessing of old events.
   */
  async seed(checkpointId: CheckpointId) {
    const cursor = new Cursor({
      ref: "seed",
      occurredAt: MicrosecondTimestamp.now(),
      revision: 0,
      eventId: EventId.generate(),
    });

    const task = new Task<false>({
      id: EventId.generate(),
      ref: "Seed",
      occurredAt: cursor.occurredAt,
      revision: cursor.revision,
      attempts: 0,
      processed: true,
      claimer: undefined,
      claimedAt: undefined,
      lock: new Lock({}),
      claimTimeout: 0,
      skipAfter: 0,
      isolateAfter: 0,
      skipped: false,
      lastUpdateTime: undefined,
    });

    try {
      const serialized = task.serialize();
      const converted = this.converter.toFirestore(serialized);
      await this.queued(checkpointId, task.cursor.eventId).create(converted);
    } catch (e) {
      // Ignore if already exists
      if (!(e instanceof AlreadyEnqueuedError)) {
        throw e;
      }
    }
  }
}

export class ClaimerId extends EventId {}
export class Task<Stored extends boolean> extends Shape({
  id: EventId,
  ref: String,
  occurredAt: MicrosecondTimestamp,
  revision: Number,
  attempts: Number,
  processed: Boolean,
  claimer: Optional(String),
  claimedAt: Optional(MicrosecondTimestamp),
  lock: Lock,
  skipAfter: Number,
  skipped: Boolean,
  isolateAfter: Number,
  claimTimeout: Number,
  lastUpdateTime: Optional(MicrosecondTimestamp),
}) {
  declare lastUpdateTime: Stored extends true
    ? MicrosecondTimestamp
    : undefined;

  get cursor() {
    return new Cursor({
      ref: this.ref,
      occurredAt: this.occurredAt,
      revision: this.revision,
      eventId: this.id,
    });
  }

  static new(
    fact: IFact,
    config: {
      lock: Lock;
      claimTimeout: number;
      skipAfter: number;
      isolateAfter: number;
    },
  ): Task<false> {
    return new Task<false>({
      id: fact.id,
      attempts: 0,
      claimer: undefined,
      processed: false,
      claimedAt: undefined,
      lock: config.lock,
      claimTimeout: config.claimTimeout,
      skipAfter: config.skipAfter,
      isolateAfter: config.isolateAfter,
      skipped: false,
      ref: fact.ref,
      revision: fact.revision,
      occurredAt: fact.occurredAt,
      lastUpdateTime: undefined,
    });
  }

  get isProcessing() {
    return !!this.claimer;
  }

  get isProcessed() {
    return !!this.processed;
  }

  get shouldSkip() {
    return this.attempts > this.skipAfter;
  }

  get shouldIsolate() {
    return this.attempts > this.isolateAfter;
  }

  checkTimeout() {
    if (!this.claimedAt) return;
    const now = MicrosecondTimestamp.now();
    const elapsedMicros = now.micros - this.claimedAt.micros;
    const timeoutMicros = BigInt(this.claimTimeout) * 1000n; // Convert ms to microseconds
    if (elapsedMicros > timeoutMicros) {
      this.claimedAt = undefined;
      this.claimer = undefined;
      this.attempts += 1;
    }

    if (this.attempts > this.skipAfter) {
      this.skipped = true;
    }
  }

  static deserializeWithLastUpdateTime(
    data: Omit<Serialized<Task<true>>, "lastUpdateTime">,
    timestamp?: MicrosecondTimestamp,
  ): Task<true> {
    const task = Task.deserialize({
      ...data,
      lastUpdateTime: timestamp as any,
    }) as Task<true>;

    return task;
  }

  static batch(tasks: Task<true>[]) {
    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];

    const batch: Task<true>[] = [];

    for (const task of tasks) {
      if (task.shouldSkip) {
        console.log(
          `Skipping task ${task.id.serialize()} due to skipAfter limit`,
        );
        continue;
      }

      if (task.shouldIsolate) {
        if (batch.length > 0) {
          return batch;
        }
        console.log(
          `Isolating task ${task.id.serialize()} due to isolateAfter limit`,
        );
        batch.push(task);
        return batch;
      }

      if (locks.some((l) => l.restrains(task.lock))) {
        locks.push(task.lock);
        continue;
      }

      if (batchLocks.some((l) => l.restrains(task.lock, false))) {
        locks.push(task.lock);
        continue;
      }

      if (task.isProcessed) {
        continue;
      }

      if (task.isProcessing) {
        locks.push(task.lock);
        continue;
      }

      batch.push(task);
      batchLocks.push(task.lock);
    }

    return batch;
  }
}
