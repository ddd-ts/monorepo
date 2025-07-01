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
} from "@ddd-ts/core";
import { MicrosecondTimestamp, Optional, Shape } from "@ddd-ts/shape";
import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
// import { Trace } from "./trace.decorator";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // throw new Error("Breathing stopped, handler flatlined");
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

    if (await this.checkIsProcessed(checkpointId, target.eventId)) {
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
  private async checkIsProcessed(checkpointId: CheckpointId, eventId: EventId) {
    return await this.queue.isProcessed(checkpointId, eventId);
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
  async isProcessed(checkpointId: CheckpointId, eventId: EventId) {
    const doc = await this.queued(checkpointId, eventId).get();
    return doc.exists && doc.data()?.processed === true;
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
