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
import { AccountCashflowProjection } from "../cashflow";
import { ProjectorSuite } from "./projection.suite";
import { Albert } from "./albert";

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
      const projection = new AccountCashflowProjection(
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

  describe("Albert", () => {
    const prepare = makePrepare(Albert.Projector, Albert.CheckpointStore);

    const suite = ProjectorSuite(prepare);

    it("SingleEvent", () => suite.SingleEvent());

    it("SimpleLocking", () => suite.SimpleLocking());

    it("SimpleConcurrency", () => suite.SimpleConcurrency());

    it("SimpleBatching", () => suite.SimpleBatching());

    it("DuplicateHandling", () => suite.DuplicateHandling(), 30_000);

    it("HeavyHandleConcurrency", () => suite.HeavyHandleConcurrency(), 40_000);

    it("ExplicitFailureRetry", () => suite.ExplicitFailureRetry(), 40_000);

    it.skip(
      "ImplicitTimeoutFailureRetry",
      () => suite.ImplicitTimeoutFailureRetry(),
      40_000,
    );
  });
});
