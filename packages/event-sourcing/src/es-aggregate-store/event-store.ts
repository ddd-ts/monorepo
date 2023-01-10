import { EsAggregate, Serializable } from "../index";

export type Follower = AsyncIterable<EsFact> & { close: () => void };

export type Constructor<T, Params extends any[] = any[]> = new (
  ...args: Params
) => T;

export type AbstractConstructor<
  T,
  Params extends any[] = any[]
> = abstract new (...args: Params) => T;

export type Attempt<T extends EsFact> = {
  fact: T;
  succeed: () => void;
  retry: () => void;
  skip: () => void;
};

export type Competitor = AsyncIterable<Attempt<EsFact>> & {
  close: () => void;
};

export interface EsEvent {
  id: string;
  type: string;
  payload: Serializable;
  revision?: bigint;
}

export type EsFact = EsEvent & { revision: bigint };
export type EsChange = EsEvent & { revision: undefined };

export type ProjectedStreamConfiguration = Constructor<EsAggregate>;

export abstract class EventStore {
  abstract appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: EsAggregate["id"],
    changes: EsChange[],
    expectedRevision: bigint
  ): Promise<void>;

  abstract readAggregateStream(
    AGGREGATE: Constructor<EsAggregate>,
    id: EsAggregate["id"],
    from?: bigint
  ): AsyncIterable<EsFact>;

  abstract readProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    from?: bigint
  ): AsyncIterable<EsFact>;

  abstract followProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    from?: bigint
  ): Promise<Follower>;

  abstract competeForProjectedStream(
    AGGREGATE: ProjectedStreamConfiguration,
    competitionName: string
  ): Promise<Competitor>;
}
