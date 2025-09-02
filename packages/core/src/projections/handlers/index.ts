import { BaseHandler } from "./base.handler";
import { WithBatchLast } from "./batch.handler";
import { WithOnProcessed } from "./checkpoint.handler";
import { WithContext } from "./context.handler";
import { WithParallel } from "./parallel.handler";
import { WithLocalRetry } from "./retry.handler";
import { WithSequential } from "./sequential.handler";
import {
  WithClaimTimeout,
  WithIsolateAfter,
  WithSkipAfter,
} from "./settings.handle";
import { WithSuspense } from "./suspense.handler";
import { WithLocalTimeout } from "./timeout.handler";
import { WithTransaction } from "./transaction.handler";

export const Handler = {
  Base: BaseHandler,
  Transaction: WithTransaction,
  Suspense: WithSuspense,
  Parallel: WithParallel,
  Sequential: WithSequential,
  BatchLast: WithBatchLast,
  Context: WithContext,
  OnProcessed: WithOnProcessed,
  LocalRetry: WithLocalRetry,
  LocalTimeout: WithLocalTimeout,
  ClaimTimeout: WithClaimTimeout,
  IsolateAfter: WithIsolateAfter,
  SkipAfter: WithSkipAfter,
} as const;

export { ProjectionContext } from "./context.handler";
