import * as fb from "firebase-admin";
import { Checkpoint, CheckpointFurtherAway } from "@ddd-ts/event-sourcing";

export class FirestoreCheckpoint extends Checkpoint {
  constructor(public readonly firestore: fb.firestore.Firestore) {
    super();
  }

  async clear() {
    const bw = this.firestore.bulkWriter();
    await this.firestore.recursiveDelete(
      this.firestore.collection("checkpoints"),
      bw
    );
    await bw.flush();
    await bw.close();
  }

  async get(name: string) {
    const checkpoint = await this.firestore
      .collection("checkpoints")
      .doc(name)
      .get();

    if (!checkpoint.exists) {
      return -1n;
    }
    return BigInt(checkpoint.data()?.revision);
  }

  async set(
    name: string,
    revision: bigint,
    trx?: FirebaseFirestore.Transaction
  ) {
    console.log("setting checkpoint", name, revision);
    const checkpointRef = await this.firestore
      .collection("checkpoints")
      .doc(name);

    const checkpoint = await checkpointRef.get();

    if (checkpoint.exists) {
      const currentRevision = BigInt(checkpoint.data()?.revision);
      if (currentRevision > revision) {
        throw new CheckpointFurtherAway(name, revision, currentRevision);
      }
    }

    if (trx) {
      trx.set(this.firestore.collection("checkpoints").doc(name), {
        revision: Number(revision),
      });
    } else {
      await checkpointRef.set({ revision: Number(revision) });
    }
  }
}
