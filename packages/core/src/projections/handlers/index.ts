import { BaseHandler } from "./base.handler";
import { WithBatchLast } from "./batch.handler";
import { WithCheckpoint, WithOnProcessed } from "./checkpoint.handler";
import { WithDebug } from "./description.handler";
import { WithParallel } from "./parallel.handler";
import {
  WithLocalRetry,
  WithIsolateAfter,
  WithSkipAfter,
} from "./retry.handler";
import { WithStore } from "./store.handler";
import { WithSuspense } from "./suspense.handler";
import { WithClaimTimeout, WithLocalTimeout } from "./timeout.handler";
import { WithTransaction } from "./transaction.handler";

export const Handler = {
  Base: BaseHandler,
  Transaction: WithTransaction,
  Suspense: WithSuspense,
  Checkpoint: WithCheckpoint,
  Parallel: WithParallel,
  BatchLast: WithBatchLast,
  Store: WithStore,
  OnProcessed: WithOnProcessed,
  LocalRetry: WithLocalRetry,
  LocalTimeout: WithLocalTimeout,
  RetryInIsolationAfter: WithIsolateAfter,
  SkipAfter: WithSkipAfter,
  ClaimTimeout: WithClaimTimeout,
  Debug: WithDebug,
} as const;
