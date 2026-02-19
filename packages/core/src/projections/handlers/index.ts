import { BaseHandler, WithProps } from "./base.handler";
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
import { WithDelay } from "./delay.handler";
import { WithCancellable } from "./cancellable.handler";

export const Handler = {
  Base: BaseHandler,
  Transaction: WithTransaction,
  Cancellable: WithCancellable,
  Suspense: WithSuspense,
  Parallel: WithParallel,
  Sequential: WithSequential,
  BatchLast: WithBatchLast,
  Context: WithContext,
  OnProcessed: WithOnProcessed,
  LocalRetry: WithLocalRetry,
  LocalTimeout: WithLocalTimeout,
  Delay: WithDelay,
  ClaimTimeout: WithClaimTimeout,
  IsolateAfter: WithIsolateAfter,
  SkipAfter: WithSkipAfter,
  WithProps: WithProps,
} as const;

export { DerivedDescription } from "./description";

export { ProjectionContext } from "./context.handler";
