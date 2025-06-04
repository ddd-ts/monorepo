process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

if (process.env.DEBUG) {
  jest.setTimeout(100_000);
} else {
  jest.setTimeout(10_000);
}

import * as fb from "firebase-admin";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";

import { FirestoreProjectedStreamReader } from "../../firestore.projected-stream.reader";
import { AccountStore, registry } from "../registry";
import { Albert } from "./albert";
import { Ben } from "./ben";
import { Carl, max } from "./carl";
import { AccountCashflowProjection2 } from "../cashflow2";
import { ProjectorSuite2 } from "./projection.suite2";

describe("Projectors", () => {
  const app = fb.initializeApp({ projectId: "demo-es" });
  const firestore = app.firestore();

  function makePrepare(ProjectorClass: any, CheckpointStoreClass: any) {
    return function prepare() {
      const reader = new FirestoreProjectedStreamReader<any>(
        firestore,
        registry,
      );
      const accountStore = new AccountStore(firestore);
      const transaction = new FirestoreTransactionPerformer(firestore);
      const checkpointStore = new CheckpointStoreClass(firestore);
      const projection = new AccountCashflowProjection2(
        transaction,
        checkpointStore as any,
      );

      const projector = new ProjectorClass(
        projection,
        reader,
        checkpointStore as any,
        transaction,
      );

      return {
        app,
        firestore,
        reader,
        accountStore,
        projection,
        checkpointStore,
        projector,
        transaction,
      };
    };
  }

  it("test", async () => {
    await firestore.collection("test").doc("test").set({ a: 100 });

    await firestore
      .collection("test")
      .doc("test")
      .update({
        a: max(101),
      });
  });

  describe("Albert", () => {
    const prepare = makePrepare(Albert.Projector, Albert.CheckpointStore);

    const suite = ProjectorSuite2(prepare);

    it("SingleEvent", () => suite.SingleEvent());

    it("SimpleLocking", () => suite.SimpleLocking());

    it("SimpleConcurrency", () => suite.SimpleConcurrency());

    it("SimpleBatching", () => suite.SimpleBatching());

    it("DuplicateHandling", () => suite.DuplicateHandling(), 30_000);

    it("HeavyHandleConcurrency", () => suite.HeavyHandleConcurrency(), 40_000);

    // it("ExplicitFailureRetry", () => suite.ExplicitFailureRetry(), 40_000);

    // it.skip(
    //   "ImplicitTimeoutFailureRetry",
    //   () => suite.ImplicitTimeoutFailureRetry(),
    //   40_000,
    // );
  });

  describe("Ben", () => {
    const prepare = makePrepare(Ben.Projector, Ben.CheckpointStore);

    const suite = ProjectorSuite2(prepare);

    it("SingleEvent", () => suite.SingleEvent());

    it("SimpleLocking", () => suite.SimpleLocking());

    it("SimpleConcurrency", () => suite.SimpleConcurrency());

    it("SimpleBatching", () => suite.SimpleBatching());

    it("DuplicateHandling", () => suite.DuplicateHandling(), 30_000);

    it("HeavyHandleConcurrency", () => suite.HeavyHandleConcurrency(), 40_000);

    // it("ExplicitFailureRetry", () => suite.ExplicitFailureRetry(), 40_000);

    // it.skip(
    //   "ImplicitTimeoutFailureRetry",
    //   () => suite.ImplicitTimeoutFailureRetry(),
    //   40_000,
    // );
  });

  describe("Carl", () => {
    const prepare = makePrepare(Carl.Projector, Carl.CheckpointStore);

    const suite = ProjectorSuite2(prepare);

    it("SingleEvent", () => suite.SingleEvent());

    it("SimpleLocking", () => suite.SimpleLocking());

    it("SimpleConcurrency", () => suite.SimpleConcurrency());

    it("SimpleBatching", () => suite.SimpleBatching());

    it("DuplicateHandling", () => suite.DuplicateHandling(), 30_000);

    it("HeavyHandleConcurrency", () => suite.HeavyHandleConcurrency(), 100_000);

    // it("ExplicitFailureRetry", () => suite.ExplicitFailureRetry(), 40_000);

    // it.skip(
    //   "ImplicitTimeoutFailureRetry",
    //   () => suite.ImplicitTimeoutFailureRetry(),
    //   40_000,
    // );
  });
});
