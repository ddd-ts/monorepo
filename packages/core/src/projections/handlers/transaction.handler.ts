import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description";
import {
  Transaction,
  TransactionPerformer,
} from "../../components/transaction";

export const WithTransaction = <T extends Transaction>() =>
  Subtrait([{} as ReturnType<typeof BaseHandler>], (base, Props) => {
    abstract class WithTransaction extends base {
      declare description: Description<{
        name: "withTransaction";
        process: "transactionally";
      }>;

      constructor(
        public props: { transaction: TransactionPerformer<T> } & typeof Props,
      ) {
        super(props);
      }

      declare context: {
        trx: T;
      };

      async process(events: this["event"][], context: {}) {
        await this.props.transaction.perform(async (trx) => {
          return super.process(events, { ...context, trx: trx });
        });
        return events.map((event) => event.id);
      }
    }
    return WithTransaction;
  });
