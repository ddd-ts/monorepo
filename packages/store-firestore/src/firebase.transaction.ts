import { Firestore } from "firebase-admin/firestore";
import { TransactionPerformer } from "@ddd-ts/model";

export class FirebaseTransactionPerformer extends TransactionPerformer {
  constructor(db: Firestore) {
    super((effect) => db.runTransaction(effect));
  }
}
