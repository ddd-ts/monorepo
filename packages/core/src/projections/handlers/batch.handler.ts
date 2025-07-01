import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description.handler";
import { CheckpointId } from "../checkpoint";
import { IEsEvent } from "../../interfaces/es-event";
import { Transaction } from "../../components/transaction";

export const WithBatchLast = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithBatchLast extends base {
    declare description: Description<{
      name: "WithBatchLast";
      handle: "call handleLast with the last event of the batch";
    }>;
    declare context: { checkpointId: CheckpointId };

    abstract handleLast(
      event: IEsEvent,
      context: this["context"],
    ): Promise<void>;

    async handle(events: IEsEvent[], context: this["context"]) {
      const last = events.at(-1);
      if (!last) {
        console.warn("WithBatchLast.handle called with no events");
        return;
      }
      await this.handleLast(last, context);
    }

    async process(
      events: IEsEvent[],
      context: { checkpointId: CheckpointId; transaction?: Transaction },
    ) {
      await super.process(events, context);
      return events.map((event) => event.id);
    }
  }
  return WithBatchLast;
});
