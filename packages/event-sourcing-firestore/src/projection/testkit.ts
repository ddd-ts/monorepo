process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "localhost:8080";
import * as fb from "firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import { FirestoreProjector, FirestoreQueueStore } from "./firestore.projector";
import { FirestoreProjectedStreamReader } from "../firestore.projected-stream.reader";
import { MakeFirestoreEventStreamAggregateStore } from "../firestore.event-stream.aggregate-store";
import { IEventBus, ProjectorTesting } from "@ddd-ts/core";
import { FirestoreTransactionPerformer } from "@ddd-ts/store-firestore";

// Common registry for account events used across tests
export const registry = ProjectorTesting.Registry;

export type DbHandle = {
  app: fb.app.App;
  db: Firestore;
};

export function getDb(projectId = "demo-es"): DbHandle {
  const app = fb.apps.length ? fb.app() : fb.initializeApp({ projectId });
  return { app, db: app.firestore() };
}

// Account event store helper (used by most projector tests)
export class AccountStore extends MakeFirestoreEventStreamAggregateStore(
  ProjectorTesting.Account,
) {
  constructor(firestore: Firestore, eventBus?: IEventBus) {
    super(firestore, registry, eventBus);
  }
}

// Minimal projector wiring util
export function makeProjector(params: {
  db: Firestore;
  projection: any; // ESProjection<IEsEvent>
}) {
  const { db, projection } = params;
  const reader = new FirestoreProjectedStreamReader<any>(db, registry);
  const queueStore = new FirestoreQueueStore(db);
  const projector = new FirestoreProjector(projection, reader, queueStore, {
    onEnqueueError: console.log,
    onProcessError: console.error,
    retry: { attempts: 40, minDelay: 100, maxDelay: 1000 },
    enqueue: { batchSize: 50 },
  });

  return { reader, queueStore, projector };
}

// Firestore transaction performer (commonly passed to handlers)
export function makeTransaction(db: Firestore) {
  return new FirestoreTransactionPerformer(db);
}
