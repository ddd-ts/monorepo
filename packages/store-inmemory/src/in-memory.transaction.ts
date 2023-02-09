import { TransactionPerformer } from "@ddd-ts/model";
import {
  InMemoryDatabase,
  InMemoryTransaction,
} from "./store/in-memory.database";

export class InMemoryTransactionPerformer extends TransactionPerformer<InMemoryTransaction> {
  constructor(db: InMemoryDatabase) {
    super((effect) => db.transactionally(effect));
  }
}

export class FakeInMemoryTransactionPerformer extends TransactionPerformer<null> {
  constructor() {
    super((effect) => effect(null));
  }
}
