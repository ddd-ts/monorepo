import { TransactionPerformer } from "@ddd-ts/event-sourcing";
import { InMemoryDatabase } from "./store/in-memory.database";

export class InMemoryTransactionPerformer extends TransactionPerformer {
  constructor(db: InMemoryDatabase) {
    super((effect) => db.transactionally(effect));
  }
}
