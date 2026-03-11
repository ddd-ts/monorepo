import {
  CheckpointId,
  Cursor,
  ESProjection,
  EventId,
  type IEsEvent,
  type IFact,
  type ISavedChange,
  Lock,
  ProjectedStream,
  ProjectedStreamReader,
  type Serialized,
} from "@ddd-ts/core";
import { Mapping, MicrosecondTimestamp, Optional, Shape } from "@ddd-ts/shape";
import {
  DefaultConverter,
  FirestoreTransaction,
} from "@ddd-ts/store-firestore";
import {
  FieldValue,
  Firestore,
  Timestamp,
  WriteBatch,
} from "firebase-admin/firestore";
const Status = {
  SUCCESS: "OK",
  FAILURE: "FAILURE",
  DEFERRED: "DEFERRED",
} as const;
type Status = (typeof Status)[keyof typeof Status];

const TaskState = {
  ENQUEUED: "ENQUEUED",
  PROCESSED: "PROCESSED",
  MISSING: "MISSING",
} as const;
type TaskState = (typeof TaskState)[keyof typeof TaskState];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const RETENTION = MicrosecondTimestamp.MONTH;

export interface ProjectorLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const defaultLogger: ProjectorLogger = {
  debug: (msg, ctx) => console.debug(msg, ctx ?? ""),
  info: (msg, ctx) => console.info(msg, ctx ?? ""),
  warn: (msg, ctx) => console.warn(msg, ctx ?? ""),
  error: (msg, ctx) => console.error(msg, ctx ?? ""),
};

interface FirestoreProjectorConfig {
  retry: {
    attempts: number;
    minDelay: number;
    maxDelay: number;
    backoff: number;
  };
  enqueue: {
    batchSize: number;
  };
  logger?: ProjectorLogger;
  /** @deprecated Use `logger.error` instead */
  onProcessError: (error: Error) => void;
  /** @deprecated Use `logger.error` instead */
  onEnqueueError: (error: Error) => void;
}

export class FirestoreProjector {
  _unclaim = true;

  constructor(
    public readonly projection: ESProjection<IEsEvent>,
    public readonly reader: ProjectedStreamReader<IEsEvent>,
    public readonly queue: FirestoreQueueStore,
    public config: FirestoreProjectorConfig = {
      retry: { attempts: 10, minDelay: 10, maxDelay: 200, backoff: 1.5 },
      enqueue: { batchSize: 100 },
      logger: defaultLogger,
      onProcessError: (error: Error) => {
        console.error("Error processing event:", error);
      },
      onEnqueueError: (error: Error) => {
        console.error("Error enqueuing tasks:", error);
      },
    },
  ) {}

  private get logger(): ProjectorLogger {
    return this.config.logger ?? defaultLogger;
  }

  async *breathe() {
    const { attempts, minDelay, maxDelay, backoff } = this.config.retry;

    for (let i = 0; i < attempts; i++) {
      const reset = () => {
        i--;
      };

      yield [i, reset] as const;

      const margin = maxDelay - minDelay;
      const jitter = Math.random() * margin;

      const backedoff = (backoff * i + 1) * minDelay;
      const jitteredDelay = backedoff + jitter;

      await wait(jitteredDelay);
    }
  }

  // Debounce map: tracks per-checkpoint processing state.
  // When a checkpoint key is present, processing is active.
  // null = processing with no pending re-run.
  // { savedChange, cursor } = a newer event arrived; re-run targeting the max cursor seen.
  private processingCheckpoints: Map<
    string,
    { savedChange: ISavedChange<IEsEvent>; cursor: Cursor } | null
  > = new Map();
  private coalescedCounts: Map<string, number> = new Map();

  // Tracks all events that arrived while a checkpoint was processing.
  // After each enqueue/slice, covered event IDs are pruned.
  // Any remaining after processing are "stragglers" — events not covered
  // by any slice (e.g. not yet visible in the stream at query time).
  private pendingCursors: Map<
    string,
    Map<string, { savedChange: ISavedChange<IEsEvent>; cursor: Cursor }>
  > = new Map();

  private prunePendingCursors(checkpointId: CheckpointId, eventIds: EventId[]) {
    const key = checkpointId.serialize();
    const pending = this.pendingCursors.get(key);
    if (!pending) return;
    for (const eventId of eventIds) {
      pending.delete(eventId.serialize());
    }
  }

  async handle(savedChange: ISavedChange<IEsEvent>) {
    const checkpointId = this.projection.getCheckpointId(savedChange);
    const key = checkpointId.serialize();

    // Eagerly resolve the cursor so we can compare ordering
    const cursor = await this.getCursor(savedChange);
    if (!cursor) {
      throw new Error(
        `Cursor not found for event ${savedChange.id.serialize()}`,
      );
    }

    if (this.processingCheckpoints.has(key)) {
      // Track this event so we can verify it was enqueued after processing.
      // Events covered by a slice are pruned; any remaining are handled individually.
      if (!this.pendingCursors.has(key)) {
        this.pendingCursors.set(key, new Map());
      }
      const eventId = savedChange.id.serialize();
      this.pendingCursors.get(key)!.set(eventId, { savedChange, cursor });

      // Keep the event with the highest cursor as the debounce re-run target.
      // Lower-cursor events are safe: they're either covered by the slice
      // (head → max target) or caught as stragglers after processing.
      const existing = this.processingCheckpoints.get(key);
      if (!existing || cursor.isAfter(existing.cursor)) {
        this.processingCheckpoints.set(key, { savedChange, cursor });
      }
      const coalesced = (this.coalescedCounts.get(key) ?? 0) + 1;
      this.coalescedCounts.set(key, coalesced);
      this.logger.debug(
        `debounced: Checkpoint<${key}> is processing, Event<${eventId}> coalesced (${coalesced} pending)`,
        { checkpointId: key, eventId, coalesced },
      );
      return;
    }

    this.processingCheckpoints.set(key, null);

    try {
      await this.handleOne(savedChange, cursor);

      // Returns the next event to process: either a debounced re-run
      // (higher cursor arrived during processing) or a straggler
      // (event not covered by any slice). Returns null when done.
      const nextPending = (): {
        type: "debounced" | "straggler";
        savedChange: ISavedChange<IEsEvent>;
        cursor: Cursor;
        eventId: string;
      } | null => {
        const debounced = this.processingCheckpoints.get(key);
        if (debounced) {
          this.processingCheckpoints.set(key, null);
          return {
            type: "debounced",
            savedChange: debounced.savedChange,
            cursor: debounced.cursor,
            eventId: debounced.savedChange.id.serialize(),
          };
        }
        const remaining = this.pendingCursors.get(key);
        if (remaining && remaining.size > 0) {
          const next = remaining.entries().next().value!;
          const [eventId, straggler] = next;
          remaining.delete(eventId);
          return {
            type: "straggler",
            savedChange: straggler.savedChange,
            cursor: straggler.cursor,
            eventId,
          };
        }
        return null;
      };

      let iterations = 0;
      for (let next = nextPending(); next; next = nextPending()) {
        iterations++;
        if (iterations > 10) {
          this.logger.warn(
            `high-iteration: Checkpoint<${key}> re-run loop at iteration ${iterations}`,
            { checkpointId: key, iterations },
          );
        }
        if (next.type === "debounced") {
          this.logger.debug(
            `re-run: Checkpoint<${key}> iteration ${iterations}, targeting Event<${next.eventId}>`,
            { checkpointId: key, iterations, eventId: next.eventId },
          );
        } else {
          const remaining = this.pendingCursors.get(key);
          this.logger.info(
            `straggler: Checkpoint<${key}> handling Event<${next.eventId}> not covered by any slice (${remaining?.size ?? 0} remaining)`,
            {
              checkpointId: key,
              eventId: next.eventId,
              remainingStragglers: remaining?.size ?? 0,
            },
          );
        }
        await this.handleOne(next.savedChange, next.cursor);
      }
    } finally {
      this.processingCheckpoints.delete(key);
      this.pendingCursors.delete(key);
      this.coalescedCounts.delete(key);
    }
  }

  private async handleOne(savedChange: ISavedChange<IEsEvent>, target: Cursor) {
    const checkpointId = this.projection.getCheckpointId(savedChange);
    const eventId = savedChange.id.serialize();
    const checkpointKey = checkpointId.serialize();
    const startedAt = Date.now();

    this.logger.info(
      `processing: Checkpoint<${checkpointKey}> targeting Event<${eventId}>`,
      {
        checkpointId: checkpointKey,
        eventId,
        target: target.toString(),
        targetRef: target.ref,
      },
    );

    const errors = [];

    for await (const [attempt, reset] of this.breathe()) {
      const source = this.projection.getSource(savedChange);
      const [status, message] = await this.attempt(
        source,
        checkpointId,
        target,
      );

      if (status === Status.DEFERRED) {
        reset();
        continue;
      }

      if (status === Status.SUCCESS) {
        await this.queue.cleanup(checkpointId);
        const durationMs = Date.now() - startedAt;
        this.logger.info(
          `processed: Checkpoint<${checkpointKey}> caught up to Event<${eventId}> in ${durationMs}ms`,
          { checkpointId: checkpointKey, eventId, durationMs },
        );
        return;
      }

      errors.push(message);
    }

    const { attempts } = this.config.retry;
    this.logger.error(
      `failed: Checkpoint<${checkpointKey}> exhausted ${attempts} retries for Event<${eventId}>`,
      { checkpointId: checkpointKey, eventId, attempts, errors },
    );

    throw new Error(`Failed to handle event ${eventId}: ${errors.join(", ")}`);
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

    const isTargetAfterHead = !headCursor || target.isAfter(headCursor);

    if (isTargetAfterHead) {
      const [status, message] = await this.enqueue(
        source,
        headCursor,
        checkpointId,
        target,
      );
      if (status === Status.DEFERRED) {
        return [Status.DEFERRED, message] as const;
      }
    }

    if (!isTargetAfterHead) {
      const processed = await this.checkIsProcessed(checkpointId, target);
      if (processed === TaskState.PROCESSED) {
        this.prunePendingCursors(checkpointId, [target.eventId]);
        return [Status.SUCCESS, "Target event already processed"] as const;
      }

      if (processed === TaskState.MISSING) {
        const [status, message] = await this.enqueueOne(checkpointId, target);
        if (status === Status.DEFERRED) {
          return [Status.FAILURE, message] as const;
        }
      }
    }

    const unprocessed = await this.getUnprocessed(checkpointId);

    if (!unprocessed.length) {
      return [Status.FAILURE, "No unprocessed tasks found"] as const;
    }

    const batch = Task.batch(unprocessed);

    if (!batch.length) {
      return [
        Status.DEFERRED,
        "No tasks available to claim, deferring",
      ] as const;
    }

    const claimer = ClaimerId.generate();

    const [status, message] = await this.claimTasks(
      checkpointId,
      claimer,
      batch,
    );

    if (status === Status.FAILURE) {
      return [Status.DEFERRED, message] as const;
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
    head: Cursor | undefined,
    checkpointId: CheckpointId,
    target: Cursor,
  ) {
    const shard = checkpointId.shard();
    const headCursor = head;
    const limit = this.config.enqueue.batchSize;
    return this.reader.slice(source, shard, headCursor, target, limit);
  }

  // @Trace("projector.enqueue")
  private async enqueue(
    source: ProjectedStream,
    head: Cursor | undefined,
    checkpointId: CheckpointId,
    target: Cursor,
  ) {
    const events = await this.readSourceStream(
      source,
      head,
      checkpointId,
      target,
    );

    const tasks = events.map((e) => {
      const settings = this.projection.getTaskSettings(e);
      return Task.new(e, settings);
    });

    const result = await this.queue.enqueue(checkpointId, tasks);

    // Prune pending cursors for events covered by this slice.
    // On SUCCESS all tasks were created; on AlreadyEnqueuedError the batch
    // failed atomically so we only prune on SUCCESS.
    const [status] = result;
    if (status === Status.SUCCESS) {
      this.prunePendingCursors(
        checkpointId,
        tasks.map((t) => t.id),
      );
    }

    const checkpointKey = checkpointId.serialize();
    this.logger.debug(
      `enqueued: Checkpoint<${checkpointKey}> added ${tasks.length} tasks to queue`,
      { checkpointId: checkpointKey, count: tasks.length },
    );

    return result;
  }

  private async enqueueOne(checkpointId: CheckpointId, target: Cursor) {
    const event = await this.reader.get(target);
    if (!event) {
      throw new Error(`Event not found for cursor ${target.ref}`);
    }

    const settings = this.projection.getTaskSettings(event);
    const task = Task.new(event, settings);
    const result = await this.queue.enqueue(checkpointId, [task]);

    const [status] = result;
    if (status === Status.SUCCESS) {
      this.prunePendingCursors(checkpointId, [task.id]);
    }

    return result;
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
      return [Status.SUCCESS, "Tasks claimed successfully"] as const;
    } catch (e) {
      return [Status.FAILURE, e] as const;
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

    if (!filtered.length) {
      // Nothing to process, possibly all tasks were for events that no longer exist
      return [
        Status.DEFERRED,
        "No events to process in claimed tasks",
      ] as const;
    }

    const onProcessed = this.queue.processed.bind(this.queue, claimer);
    const assertBeforeInsert = this.assertBeforeInsert.bind(
      this,
      checkpointId,
      claimer,
      filtered,
    );
    const context = { onProcessed, checkpointId, assertBeforeInsert };

    const hasTarget = tasks.some((t) => t.id.equals(targetEventId));

    try {
      const processed = await this.projection.process(filtered, context);

      if (processed.some((id) => id?.equals(targetEventId))) {
        return [Status.SUCCESS, "Target event processed successfully"] as const;
      }

      return [Status.DEFERRED, "Target event not processed yet"] as const;
    } catch (e) {
      const checkpointKey = checkpointId.serialize();
      const errorMessage = e instanceof Error ? e.message : String(e);
      const truncated =
        errorMessage.length > 200
          ? `${errorMessage.slice(0, 200)}...`
          : errorMessage;
      this.logger.error(
        `error: Checkpoint<${checkpointKey}> processing failed: ${truncated}`,
        { checkpointId: checkpointKey, error: e },
      );
      this.config.onProcessError(e as Error);
      if (this._unclaim) {
        await this.queue.unclaim(checkpointId, tasks);
      }

      if (!hasTarget) {
        return [
          Status.DEFERRED,
          "Target event not in claimed batch, deferring",
        ] as const;
      }

      return [Status.FAILURE, e] as const;
    }
  }

  private async assertBeforeInsert(
    checkpointId: CheckpointId,
    claimer: ClaimerId,
    events: IEsEvent[],
  ) {
    const claimedTasks = await this.queue.claimed(checkpointId, claimer);
    const claimedTasksMap = new Map(
      claimedTasks.map((t) => [t.id.serialize(), t]),
    );

    for (const event of events) {
      const task = claimedTasksMap.get(event.id.serialize());
      if (!task) {
        throw new Error(
          `Task not found for event ${event.id.serialize()} in claimer ${claimer.serialize()}`,
        );
      }

      if (task.claimIds?.[0] !== claimer.serialize()) {
        throw new Error(
          `Task ${task.id.serialize()} claimer mismatch: expected ${claimer.serialize()}, found ${task.claimIds?.[0]}`,
        );
      }
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
      "checkpoints",
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
    // console.log(
    //   `Enqueuing ${tasks.length} tasks for checkpoint ${checkpointId.serialize()}`,
    // );

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
      return [Status.SUCCESS, "Tasks enqueued successfully"] as const;
    } catch (err: any) {
      if (err.code === 6) {
        return [Status.DEFERRED, new AlreadyEnqueuedError()] as const;
      }
      return [Status.DEFERRED, err] as const;
    }
  }

  async claim(
    checkpointId: CheckpointId,
    claimer: ClaimerId,
    tasks: Task<true>[],
  ) {
    const batch = this.collection.firestore.batch();

    for (const task of tasks) {
      if (task.claimIds.length > 0) {
        throw new Error(
          `Task ${task.id.serialize()} is already claimed by ${task.claimIds.join(", ")}`,
        );
      }
      const ref = this.queued(checkpointId, task.id);
      batch.update(
        ref,
        {
          /** @deprecated */ claimer: claimer.serialize(),
          /** @deprecated */ claimedAt: FieldValue.serverTimestamp(),
          [`claimsMetadata.${claimer.serialize()}`]: {
            claimedAt: FieldValue.serverTimestamp(),
          },
          claimIds: FieldValue.arrayUnion(claimer.serialize()),
          attempts: FieldValue.increment(1),
          remaining: FieldValue.increment(-1),
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
      .where("remaining", ">", 0)
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc")
      .limit(100);

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
      const originalClaimIds = task.claimIds;
      task.checkTimeout();

      // If timeout cleared the claimer, we need to update the database
      if (originalClaimIds.length > task.claimIds.length) {
        expiredTasks.push(task);
      }
    }

    // Update expired tasks in the database
    if (expiredTasks.length > 0) {
      const batch = this.collection.firestore.batch();
      for (const task of expiredTasks) {
        const ref = this.queued(checkpointId, task.id);
        batch.update(
          ref,
          {
            /** @deprecated */ claimer: FieldValue.delete(),
            /** @deprecated */ claimedAt: FieldValue.delete(),
            claimIds: task.claimIds,
          },
          { lastUpdateTime: this.microsecondsToTimestamp(task.lastUpdateTime) },
        );
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
      .where("claimIds", "array-contains", claimer.serialize())
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc");

    const snapshot = await query.get();
    return snapshot.docs
      .map((doc) => {
        const data = this.converter.fromFirestoreSnapshot(doc);
        const timestamp = doc.updateTime
          ? this.timestampToMicroseconds(doc.updateTime as Timestamp)
          : undefined;
        return Task.deserializeWithLastUpdateTime(data as any, timestamp);
      })
      .filter((task) => task.claimIds[0] === claimer.serialize());
  }

  async unclaim(checkpointId: CheckpointId, tasks: Task<true>[]) {
    const batch = this.collection.firestore.batch();

    for (const task of tasks) {
      const ref = this.queued(checkpointId, task.id);
      batch.update(
        ref,
        {
          /** @deprecated */ claimer: FieldValue.delete(),
          /** @deprecated */ claimedAt: FieldValue.delete(),
          claimIds: FieldValue.arrayRemove(task.currentClaimId),
        },
        { lastUpdateTime: this.microsecondsToTimestamp(task.lastUpdateTime) },
      );
    }

    await batch.commit();
  }

  /**
   * If the task exists, then looks for a processed flag.
   * If not found, check if the cursor is older than the retention time for processed event.
   * If so, consider it processed.
   * Otherwise, consider it missing.
   */
  async isProcessed(checkpointId: CheckpointId, cursor: Cursor) {
    const doc = await this.queued(checkpointId, cursor.eventId).get();
    if (doc.exists) {
      const data = doc.data();
      if (!data) throw new Error("No data in queued document");
      if (data.processed === true) return TaskState.PROCESSED;
      return TaskState.ENQUEUED;
    }

    const lastRetention = MicrosecondTimestamp.now().sub(RETENTION);
    if (cursor.isOlderThan(lastRetention)) {
      return TaskState.PROCESSED;
    }
    return TaskState.MISSING;
  }

  checkpoint(id: CheckpointId) {
    return this.collection.doc(id.name).collection("shards");
  }

  queue(id: CheckpointId) {
    return this.checkpoint(id).doc(id.shard()).collection("queue");
  }

  queued(id: CheckpointId, eventId: EventId) {
    return this.queue(id).doc(eventId.serialize());
  }

  async processed(
    claimerId: ClaimerId,
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
        trx.transaction.update(ref, {
          processed: true,
          [`claimsMetadata.${claimerId.serialize()}.processedAt`]:
            FieldValue.serverTimestamp(),
        });
      }
      return;
    }

    await Promise.all(
      eventIds.map((eventId) =>
        this.queued(id, eventId).update({
          processed: true,
          [`claimsMetadata.${claimerId.serialize()}.processedAt`]:
            FieldValue.serverTimestamp(),
        }),
      ),
    );

    return;
  }

  async getTailCursor(id: CheckpointId) {
    const tail = this.queue(id)
      .where("remaining", ">", 0)
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
    const aMonthAgo = MicrosecondTimestamp.now().sub(
      MicrosecondTimestamp.WEEK.mult(4),
    );

    const query = this.queue(id)
      .where("remaining", ">", 0)
      .where("occurredAt", "<", aMonthAgo.serialize()) // Only consider events older than 4 weeks
      .orderBy("occurredAt", "asc")
      .orderBy("revision", "asc");

    const MIN_TRAIL = 1; // Keep at least one processed document to maintain the tail cursor
    const TRAIL = MIN_TRAIL + 0; // Extra buffer to optimize isProcessed checks

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
      /** @deprecated */ claimer: undefined,
      /** @deprecated */ claimedAt: undefined,
      claimsMetadata: {},
      claimIds: [],
      lock: new Lock({}),
      remaining: 1,
      claimTimeout: 0,
      skipAfter: 0,
      isolateAfter: 0,
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
  /** @deprecated */ claimer: Optional(String),
  /** @deprecated */ claimedAt: Optional(MicrosecondTimestamp),
  claimsMetadata: Mapping([
    {
      claimedAt: MicrosecondTimestamp,
      processedAt: Optional(MicrosecondTimestamp),
    },
  ]),
  claimIds: [String],
  lock: Lock,
  skipAfter: Number,
  remaining: Number,
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
      /** @deprecated */ claimer: undefined,
      processed: false,
      /** @deprecated */ claimedAt: undefined,
      claimsMetadata: {},
      claimIds: [],
      lock: config.lock,
      claimTimeout: config.claimTimeout,
      skipAfter: config.skipAfter,
      isolateAfter: config.isolateAfter,
      remaining: config.skipAfter,
      ref: fact.ref,
      revision: fact.revision,
      occurredAt: fact.occurredAt,
      lastUpdateTime: undefined,
    });
  }

  get currentClaimId() {
    // TODO: we should check the claim metadata for the latest valid claim
    return this.claimIds.at(-1);
  }

  get isProcessing() {
    return this.currentClaimId !== undefined;
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
    const claimer = this.currentClaimId;
    if (!claimer) return;

    const claimInfo = this.claimsMetadata[claimer];
    if (!claimInfo || !claimInfo.claimedAt) return;

    const now = MicrosecondTimestamp.now();
    const elapsedMicros = now.micros - claimInfo.claimedAt.micros;
    const timeoutMicros = BigInt(this.claimTimeout) * 1000n; // Convert ms to microseconds

    if (elapsedMicros > timeoutMicros) {
      this.claimIds = this.claimIds.filter((id) => id !== claimer);
    }
  }

  static deserializeWithLastUpdateTime(
    data: Omit<Serialized<Task<true>>, "lastUpdateTime">,
    timestamp?: MicrosecondTimestamp,
  ): Task<true> {
    const task = Task.deserialize({
      ...data,
      lastUpdateTime: timestamp as any,
      claimIds: data.claimIds || [],
      claimsMetadata: data.claimsMetadata || {},
    }) as Task<true>;

    return task;
  }

  static batch(tasks: Task<true>[]) {
    // console.log(
    //   JSON.stringify(
    //     tasks.map((t) => t.serialize()),
    //     null,
    //     2,
    //   ),
    // );

    const locks: Lock[] = [];
    const batchLocks: Lock[] = [];

    const batch: Task<true>[] = [];

    for (const task of tasks) {
      if (task.shouldSkip) {
        // console.log(
        //   `Skipping task ${task.id.serialize()} due to skipAfter limit`,
        // );
        continue;
      }

      if (task.shouldIsolate) {
        if (batch.length > 0) {
          return batch;
        }
        // console.log(
        //   `Isolating task ${task.id.serialize()} due to isolateAfter limit`,
        // );
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
