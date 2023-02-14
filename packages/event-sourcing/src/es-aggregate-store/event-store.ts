import { EsAggregate, Serializable } from "../index";

import { Constructor } from "@ddd-ts/types";

export type Follower<E = EsFact> = AsyncIterable<E> & {
  close: () => void;
};

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

export type ProjectedStreamConfiguration = Constructor<EsAggregate<any, any>>[];

export abstract class EventStore {
  abstract appendToAggregateStream(
    AGGREGATE: Constructor<EsAggregate<any, any>>,
    id: EsAggregate<any, any>["id"],
    changes: EsChange[],
    expectedRevision: bigint
  ): Promise<void>;

  abstract readAggregateStream(
    AGGREGATE: Constructor<EsAggregate<any, any>>,
    id: EsAggregate<any, any>["id"],
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

  abstract clear(): Promise<void>;
  abstract close(): Promise<void>;
}
