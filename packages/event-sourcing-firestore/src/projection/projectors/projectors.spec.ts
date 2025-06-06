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
import { Carla } from "./carla";
import { Daniel } from "./daniel";
import { Eric } from "./eric";
import { Fabrice } from "./fabrice";
import { AccountCashflowProjection } from "../cashflow";
import { ProjectorSuite } from "./projection.suite";
import { Galway } from "./galway";

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

  // it("test", async () => {
  //   await firestore.collection("test").doc("test").set({ a: 100 });

  //   await firestore
  //     .collection("test")
  //     .doc("test")
  //     .update({
  //       a: max(101),
  //     });
  // });

  describe.skip("Albert", () => {
    const prepare = makePrepare(Albert.Projector, Albert.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Albert");

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

  describe.skip("Ben", () => {
    const prepare = makePrepare(Ben.Projector, Ben.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Ben");

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

  describe.skip("Carla", () => {
    const prepare = makePrepare(Carla.Projector, Carla.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Carla");

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

  describe("Daniel", () => {
    const prepare = makePrepare(Daniel.Projector, Daniel.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Daniel");

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

  describe("Eric", () => {
    const prepare = makePrepare(Eric.Projector, Eric.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Eric");

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

  // describe.each([...Array(1)].map((_, i) => i))("Fabrice", (i) => {
  describe("Fabrice", () => {
    const prepare = makePrepare(Fabrice.Projector, Fabrice.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Fabrice");

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

  describe("Galway", () => {
    const prepare = makePrepare(Galway.Projector, Galway.CheckpointStore);

    const suite = ProjectorSuite(prepare, "Galway");

    it("SingleEvent", () => suite.SingleEvent());

    it("SimpleLocking", () => suite.SimpleLocking());

    it("SimpleConcurrency", () => suite.SimpleConcurrency());

    it("SimpleBatching", () => suite.SimpleBatching());

    it("DuplicateHandling", () => suite.DuplicateHandling(), 30_000);

    it("HeavyHandleConcurrency", () => suite.HeavyHandleConcurrency(), 30_000);

    // it("ExplicitFailureRetry", () => suite.ExplicitFailureRetry(), 40_000);

    // it.skip(
    //   "ImplicitTimeoutFailureRetry",
    //   () => suite.ImplicitTimeoutFailureRetry(),
    //   40_000,
    // );
  });
});
