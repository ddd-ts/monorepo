import { IEsEvent } from "@ddd-ts/core";
import { FirestoreProjectedStreamReader } from "../firestore.projected-stream.reader";
import { AccountCashflowProjection } from "./cashflow";
import { ProjectionCheckpointStore } from "./checkpoint";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { Cursor } from "./thread";
import { wait } from "./tools";

export class Projector {
  constructor(
    public readonly projection: AccountCashflowProjection,
    public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
    public readonly store: ProjectionCheckpointStore,
    public readonly transaction: FirestoreTransactionPerformer,
  ) {}

  async enqueue(e: IEsEvent): Promise<boolean> {
    const checkpointId = this.projection.getShardCheckpointId(e as any);

    const accountId = e.payload.accountId.serialize();
    const until = (e as any).ref;

    await this.store.initialize(checkpointId);
    const state = await this.store.expected(checkpointId);

    const cursor = Cursor.from(e);

    if (!state.shouldEnqueue(cursor)) {
      console.log(
        `Skipping event ${e.id.serialize()} as it is after the last cursor ${state.thread.head.ref.serialize()}`,
      );
      return false;
    }

    const events = await this.reader.slice(
      this.projection.source,
      accountId,
      state.thread.head?.ref, // MAYBE HEAD ?
      until,
    );

    let i = 0;
    await this.transaction.perform(async (trx) => {
      console.log(
        `ENQUEUE ${events[0]} ${events.at(-1)} ${events.length} ${i++}`,
      );
      const state = await this.store.expected(checkpointId, trx);

      console.log(`State head: ${state.thread.tasks.length}`);

      if (!state.shouldEnqueue(cursor)) {
        console.log(`Skipping event ${e}`);
        return;
      }
      for (const event of events) {
        const lock = this.projection.handlers[event.name].locks(event as any);
        state.enqueue(event, lock);
      }
      await this.store.save(state, trx);
    });

    // const stream = this.reader.read(
    //   this.projection.source,
    //   accountId,
    //   state.thread.head?.ref, // MAYBE HEAD ?
    //   until,
    // );

    // for await (const event of stream) {
    //   const handler = this.projection.handlers[event.name];

    //   const lock = handler.locks(event as any);

    //   // TRY WITH A SINGLE TRANSACTION OR BATCH
    //   await this.transaction.perform(async (trx) => {
    //     const state = await this.store.expected(checkpointId, trx);

    //     state.enqueue(event, lock);
    //     await this.store.save(state, trx);
    //   });
    // }

    return false;
  }

  async process(event: IEsEvent): Promise<any> {
    console.log(`Projector: processing event ${event.toString()}`);
    const checkpointId = this.projection.getShardCheckpointId(event as any);

    const batch = await this.transaction.perform(async (trx) => {
      const state = await this.store.expected(checkpointId, trx);
      if (state.hasCompleted(Cursor.from(event))) {
        return false;
      }
      const batch = state.thread.startNextBatch();
      await this.store.save(state, trx);
      return batch;
    });

    if (!batch) {
      console.log(
        `Skipping event ${event.id.serialize()} as it is after the last cursor`,
      );
      return;
    }

    const events = await Promise.all(
      batch.map((cursor) => this.reader.get(cursor.ref)),
    );

    console.log(
      `Projector: processing batch of ${events.length} events`,
      events.map((e) => e.toString()),
    );
    const processed = await this.projection.process(checkpointId, events);

    if (processed.some((id) => id?.equals(event.id))) {
      console.log(`Batch contained target event ${event}`);
      return true;
    }

    console.log(`Batch did not contain target event ${event}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.process(event);
  }

  async handle(event: IEsEvent) {
    console.log(`Projector: handling event ${event.toString()}`);
    await this.enqueue(event);
    console.log(`Projector: claimed event ${event.toString()}`);
    await this.process(event);
    console.log(`Projector: processed event ${event.toString()}`);
  }
}
