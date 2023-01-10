import { TransactionPerformer } from "@ddd-ts/event-sourcing";

export class FirebaseTransactionPerformer extends TransactionPerformer {
  constructor(db: FirebaseFirestore.Firestore) {
    super((effect) => db.runTransaction(effect));
  }
}
