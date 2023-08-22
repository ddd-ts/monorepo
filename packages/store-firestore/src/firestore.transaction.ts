import { Firestore } from "firebase-admin/firestore";
import { TransactionPerformer } from "@ddd-ts/model";
import { CommitListener } from "@ddd-ts/model/dist/model/transaction";


export class FirestoreTransaction {
  commitListeners: CommitListener[] = [];
  constructor(public readonly transaction: FirebaseFirestore.Transaction) {}

  onCommit(callback: CommitListener) {
    this.commitListeners.push(callback);
  }

  async executeCommitListeners() {
    await Promise.all(this.commitListeners.map((cb) => cb()));
  }
}

export class FirestoreTransactionPerformer extends TransactionPerformer<FirestoreTransaction> {
  constructor(db: Firestore) {
    super((effect) => db.runTransaction((trx) => effect(new FirestoreTransaction(trx))));
  }
}
