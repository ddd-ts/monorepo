import * as fb from "firebase-admin";
import { Checkpoint, CheckpointFurtherAway } from "./checkpoint";

export class FirebaseCheckpoint extends Checkpoint {
  firestore: fb.firestore.Firestore;
  constructor() {
    super();
    const app = fb.initializeApp({ projectId: "demo-es" });
    this.firestore = app.firestore();
  }

  async get(name: string) {
    const checkpoint = await this.firestore
      .collection("checkpoints")
      .doc(name)
      .get();

    if (!checkpoint.exists) {
      return 0n;
    }
    return BigInt(checkpoint.data()?.revision);
  }

  async set(
    name: string,
    revision: bigint,
    trx?: FirebaseFirestore.Transaction
  ) {
    const checkpointRef = await this.firestore
      .collection("checkpoints")
      .doc(name);

    const checkpoint = trx
      ? await trx.get(checkpointRef)
      : await checkpointRef.get();

    if (checkpoint.exists) {
      const currentRevision = BigInt(checkpoint.data()?.revision);
      if (currentRevision > revision) {
        throw new CheckpointFurtherAway(name, revision, currentRevision);
      }
    }

    if (trx) {
      trx.set(this.firestore.collection("checkpoints").doc(name), {
        revision: revision.toString(),
      });
    } else {
      await checkpointRef.set({ revision });
    }
  }
}
