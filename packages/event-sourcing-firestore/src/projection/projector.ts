import { IEsEvent } from "@ddd-ts/core";
import { FirestoreProjectedStreamReader } from "../firestore.projected-stream.reader";
import { AccountCashflowProjection } from "./cashflow";
import { ProjectionCheckpointStore } from "./checkpoint";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";
import { Cursor } from "./thread";

export class Projector {
  constructor(
    public readonly projection: AccountCashflowProjection,
    public readonly reader: FirestoreProjectedStreamReader<IEsEvent>,
    public readonly store: ProjectionCheckpointStore,
    public readonly transaction: FirestoreTransactionPerformer,
  ) {}

  async claim(e: IEsEvent): Promise<boolean> {
    const checkpointId = this.projection.getShardCheckpointId(e as any);

    const accountId = e.payload.accountId.serialize();
    const until = (e as any).ref;

    await this.store.initialize(checkpointId);
    const state = await this.store.expected(checkpointId);

    const cursor = Cursor.from(e);

    if (state.thread.tail && cursor.isAfterOrEqual(state.thread.tail)) {
      console.log(
        `Skipping event ${e.id.serialize()} as it is after the last cursor ${state.thread.tail.ref.serialize()}`,
      );
      return false;
    }

    const stream = this.reader.read(
      this.projection.source,
      accountId,
      state.thread.tail?.ref,
      until,
    );

    let previous = state.thread.tail?.eventId;

    for await (const event of stream) {
      const lock = this.projection.handlers[event.name].locks(event as any);

      await this.transaction.perform(async (trx) => {
        const state = await this.store.expected(checkpointId, trx);

        state.enqueue(event, lock, previous);
        await this.store.save(state, trx);
      });

      previous = event.id;
    }

    return false;
  }

  async process(event: IEsEvent): Promise<any> {
    const checkpointId = this.projection.getShardCheckpointId(event as any);

    const batch = await this.transaction.perform(async (trx) => {
      const state = await this.store.expected(checkpointId, trx);
      state.thread.clean();
      if (state.isTailAfterOrEqual(Cursor.from(event))) {
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

    await Promise.all(
      events.map(async (event) => {
        const handler = this.projection.handlers[event.name];
        if (!handler) {
          throw new Error(`No handler for event ${event.name}`);
        }
        await this.transaction.perform(async (trx) => {
          await handler.handle(event as any);
          await this.store.processed(checkpointId, event.id, trx);
        });
      }),
    );

    if (batch.some((b) => b.eventId.equals(event.id))) {
      console.log(`Batch contained target event ${event}`);
      return true;
    }

    console.log(`Batch did not contain target event ${event}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.process(event);
    // return false;
  }

  async handle(event: IEsEvent) {
    console.log(`Projector: handling event ${event.toString()}`);
    await this.claim(event);
    console.log(`Projector: claimed event ${event.toString()}`);
    await this.process(event);
    console.log(`Projector: processed event ${event.toString()}`);
  }
}
