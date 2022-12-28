import {
  Transaction,
  TransactionPerformer,
  TransactionEffect,
} from "./transaction";

export class FirebaseTransactionPerformer extends TransactionPerformer {
  constructor(private readonly db: FirebaseFirestore.Firestore) {
    super((effect: TransactionEffect<any>) => {
      return this.db.runTransaction(async (trx) => {
        try {
          const result = await effect(trx);
          return result;
        } catch (e) {
          return Promise.reject(e);
        }
      });
    });
  }
}
