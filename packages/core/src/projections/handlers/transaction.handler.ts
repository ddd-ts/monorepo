import { Subtrait } from "@ddd-ts/traits";
import { BaseHandler } from "./base.handler";
import { Description } from "./description.handler";
import { IFact } from "../../interfaces/es-event";
import {
  Transaction,
  TransactionPerformer,
} from "../../components/transaction";

export const WithTransaction = <T extends Transaction>() =>
  Subtrait([{} as typeof BaseHandler], (base) => {
    abstract class WithTransaction extends base {
      transaction: TransactionPerformer<T>;
      declare description: Description<{
        name: "withTransaction";
        process: "transactionally";
      }>;

      constructor(props: { transaction: TransactionPerformer<T> }) {
        super(props);
        this.transaction = props.transaction;
      }

      declare context: {
        trx: T;
      };

      async process(events: IFact[], context: {}) {
        await this.transaction.perform(async (trx) => {
          return super.process(events, { ...context, trx: trx });
        });
        return events.map((event) => event.id);
      }
    }
    return WithTransaction;
  });
