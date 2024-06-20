import type {
  Firestore,
  Transaction as FirebaseTransaction,
} from "firebase-admin/firestore";
import {
  TransactionPerformer,
  type Transaction,
  type CommitListener,
} from "@ddd-ts/core";

export class FirestoreTransaction implements Transaction {
  commitListeners: CommitListener[] = [];
  constructor(public readonly transaction: FirebaseTransaction) {}

  onCommit(callback: CommitListener) {
    this.commitListeners.push(callback);
  }

  async executeCommitListeners() {
    await Promise.all(this.commitListeners.map((cb) => cb()));
  }
}

export class FirestoreTransactionPerformer extends TransactionPerformer<FirestoreTransaction> {
  constructor(db: Firestore) {
    super((effect) =>
      db.runTransaction((trx) => effect(new FirestoreTransaction(trx))),
    );
  }
}
