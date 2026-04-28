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

  // Returns a value used as the event `revision`, intended as a tiebreaker
  // when multiple events share the same `serverTimestamp()` microsecond.
  //
  // We use `process.hrtime.bigint()` (nanoseconds since process start) rather
  // than a per-transaction counter so that two concurrent transactions in
  // the same process produce distinct revisions and don't collide on
  // `(occurredAt, revision)`.
  //
  // Known limitations of this approach (see ddd-ts-prototype-overrides.md):
  // - Across processes/replicas: two processes can return the same value
  //   in the same nanosecond. Cross-replica ties are still possible (just
  //   rarer than the previous counter-based default).
  // - Cold starts: hrtime resets per process, so a freshly booted process's
  //   revisions are *lower* than an older process's tail. `revision` is not
  //   monotonic across the deployment.
  // - `Number()` cast: hrtime is a bigint of nanoseconds since process
  //   start. Exceeds Number.MAX_SAFE_INTEGER after ~104 days of uptime;
  //   acceptable for typical lifetimes, not safe long-term.
  //
  // The downstream cursor/queue layers handle ties correctly via document-id
  // tiebreak, so this is a probability reduction, not a correctness fix.
  // A pluggable revision strategy is the right long-term answer; this is the
  // safer default until that lands.
  increment() {
    return Number(process.hrtime.bigint());
  }

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
