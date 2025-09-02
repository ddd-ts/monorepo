import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";
import { CheckpointId } from "../checkpoint";
import { EventId } from "../../components/event-id";
import { Transaction } from "../../components/transaction";

export const WithOnProcessed = Subtrait(
  [{} as ReturnType<typeof BaseHandler>],
  (base) => {
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
        events: this["event"][],
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
  },
);
