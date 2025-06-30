import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description.handler";
import { CheckpointId } from "../checkpoint";
import { IEsEvent } from "../../interfaces/es-event";
import { EventId } from "../../components/event-id";
import { Transaction } from "../../components/transaction";

export type CheckpointStore = {
  processed(
    checkpointId: CheckpointId,
    event: EventId[],
    context: { transaction?: Transaction },
  ): Promise<void>;
};

export const WithCheckpoint = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithCheckpoint extends base {
    declare description: Description<{
      name: "withCheckpoint";
      after_process: "update checkpoint store with processed events";
    }>;
    checkpointStore: CheckpointStore;
    constructor(props: {
      checkpointStore: CheckpointStore;
    }) {
      super(props);
      this.checkpointStore = props.checkpointStore;
    }

    declare context: { checkpointId: CheckpointId };

    async process(
      events: IEsEvent[],
      context: { checkpointId: CheckpointId; transaction?: Transaction },
    ) {
      await super.process(events, context);
      const ids = events.map((event) => event.id);
      await this.checkpointStore.processed(context.checkpointId, ids, context);
      return ids;
    }
  }
  return WithCheckpoint;
});

export const WithOnProcessed = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithOnProcessed extends base {
    declare description: Description<{
      name: "WithOnProcessed";
      after_process: "call onProcessed with processed event ids";
    }>;
    declare context: {
      checkpointId: CheckpointId;
      onProcessed: (ids: EventId[]) => void;
    };

    async process(
      events: IEsEvent[],
      context: {
        checkpointId: CheckpointId;
        transaction?: Transaction;
        onProcessed: (
          checkpointId: CheckpointId,
          ids: EventId[],
          context: { transaction?: Transaction },
        ) => void;
      },
    ) {
      await super.process(events, context);
      const ids = events.map((event) => event.id);
      await context.onProcessed(context.checkpointId, ids, context);
      return ids;
    }
  }
  return WithOnProcessed;
});
