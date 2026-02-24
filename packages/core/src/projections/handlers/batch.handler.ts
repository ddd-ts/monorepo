import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import type { Description } from "./description";
import { CheckpointId } from "../checkpoint";
import type { Transaction } from "../../components/transaction";

export const WithBatchLast = Subtrait([{} as typeof BaseHandler], (base) => {
  abstract class WithBatchLast extends base {
    declare description: Description<{
      name: "WithBatchLast";
      handle: "call handleLast with the last event of the batch";
    }>;
    declare context: { checkpointId: CheckpointId };

    abstract handleLast(
      event: this["event"],
      context: this["context"],
    ): Promise<void>;

    async handle(events: this["event"][], context: this["context"]) {
      const last = events.at(-1);
      if (!last) {
        console.warn("WithBatchLast.handle called with no events");
        return;
      }
      await this.handleLast(last, context);
    }

    async process(
      events: this["event"][],
      context: { checkpointId: CheckpointId; transaction?: Transaction },
    ) {
      await super.process(events, context);
      return events.map((event) => event.id);
    }
  }
  return WithBatchLast;
});
