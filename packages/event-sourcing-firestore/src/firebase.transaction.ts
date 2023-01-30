import { TransactionPerformer } from "@ddd-ts/model";

export class FirebaseTransactionPerformer extends TransactionPerformer {
  constructor(db: FirebaseFirestore.Firestore) {
    super((effect) => db.runTransaction(effect));
  }
}
