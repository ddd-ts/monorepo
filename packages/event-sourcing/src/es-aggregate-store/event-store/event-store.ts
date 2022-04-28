import { EsAggregate } from "../../es-aggregate/es-aggregate";
import { Fact } from "../../event/event";
import { Account, AccountId, Deposited } from "../../test";

export type Follower = AsyncIterable<Fact<Deposited>> & { close: () => void };

export type Constructor<T, Params extends any[] = any[]> = new (
  ...args: Params
) => T;

export type Attempt<T extends Fact<any>> = {
  fact: T;
  succeed: () => void;
  retry: () => void;
  skip: () => void;
};

export type Competitor = AsyncIterable<Attempt<Fact<Deposited>>> & {
  close: () => void;
};

export abstract class EventStore {
  abstract appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: EsAggregate["id"],
    changes: EsAggregate["changes"],
    expectedRevision?: bigint
  ): Promise<void>;

  abstract readAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: EsAggregate["id"],
    from?: bigint
  ): AsyncIterable<Fact<Deposited>>;

  abstract readProjectedStream(
    AGGREGATE: Constructor<EsAggregate>,
    from?: bigint
  ): AsyncIterable<Fact<Deposited>>;

  abstract followProjectedStream(
    AGGREGATE: Constructor<EsAggregate>,
    from?: bigint
  ): Promise<Follower>;

  abstract competeForProjectedStream(
    AGGREGATE: Constructor<EsAggregate>,
    competitionName: string
  ): Promise<Competitor>;
}
