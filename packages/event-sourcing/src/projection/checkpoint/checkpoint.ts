import { Transaction } from "@ddd-ts/model";

export class CheckpointFurtherAway extends Error {
  constructor(
    public readonly name: string,
    public readonly eventRevision: bigint,
    public readonly checkpointRevision: bigint
  ) {
    super(
      `Checkpoint ${name} is further ahead than expected (event ${eventRevision}n > checkpoint ${checkpointRevision}n).`
    );
  }
}

export abstract class Checkpoint {
  abstract get(name: string): Promise<bigint>;
  abstract set(
    name: string,
    revision: bigint,
    trx?: Transaction
  ): Promise<void>;
  abstract clear(): Promise<void>;
}
