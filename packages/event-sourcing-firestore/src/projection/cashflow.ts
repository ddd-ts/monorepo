import { IEsEvent, ProjectedStream, StreamSource } from "@ddd-ts/core";
import {
  Account,
  AccountId,
  AccountOpened,
  Deposited,
  Withdrawn,
} from "./write";
import { ProjectionCheckpointId } from "./checkpoint-id";
import { Lock } from "./lock";

export class AccountCashflowProjectedStream extends ProjectedStream {
  constructor() {
    super({
      sources: [
        new StreamSource({
          aggregateType: Account.name,
          shardKey: "accountId",
          events: [AccountOpened.name, Deposited.name, Withdrawn.name],
        }),
      ],
    });
  }
}

export class AccountCashflowProjection {
  state: Record<string, number> = {};

  getShardCheckpointId(event: AccountOpened | Deposited | Withdrawn) {
    return ProjectionCheckpointId.from(
      "AccountCashflow",
      event.payload.accountId,
    );
  }

  source = new AccountCashflowProjectedStream();

  awaiters = new Map<string, Set<(value: any) => void>>();

  suspended = new Map<string, Set<(value: any) => void>>();
  suspend(event: IEsEvent) {
    return new Promise((resolve) => {
      const resolvers = this.suspended.get(event.id.serialize()) || new Set();
      resolvers.add(resolve);
      this.suspended.set(event.id.serialize(), resolvers);
      for (const [key, value] of this.awaiters.entries()) {
        if (key === event.id.serialize()) {
          // biome-ignore lint/complexity/noForEach: <explanation>
          value.forEach((resolve) => resolve(undefined));
          this.awaiters.delete(key);
        }
      }
    });
  }

  isSuspended(event: IEsEvent) {
    return this.suspended.has(event.id.serialize());
  }

  resume(event: IEsEvent) {
    const resolvers = this.suspended.get(event.id.serialize());
    if (resolvers) {
      // biome-ignore lint/complexity/noForEach: <explanation>
      resolvers.forEach((resolve) => resolve(undefined));
      this.suspended.delete(event.id.serialize());
    }
  }

  async awaitSuspend(event: IEsEvent) {
    return new Promise((resolve) => {
      const resolvers = this.awaiters.get(event.id.serialize()) || new Set();
      resolvers.add(resolve);
      this.awaiters.set(event.id.serialize(), resolvers);
    });
  }

  async tick() {
    console.log("tick start");
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log("tick end");
  }

  handlers = {
    [AccountOpened.name]: {
      handle: async (event: AccountOpened) => {
        console.log("before suspend", event.toString());
        await this.suspend(event);
        console.log("after suspend", event.toString());
        if (this.state[event.payload.accountId.serialize()] !== undefined) {
          throw new Error("Account already opened");
        }
        this.state[event.payload.accountId.serialize()] = 0;
      },
      locks: (event: AccountOpened) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
        });
      },
    },
    [Deposited.name]: {
      handle: async (event: Deposited) => {
        console.log("before suspend", event.toString());
        await this.suspend(event);
        console.log("after suspend", event.toString());
        if (this.state[event.payload.accountId.serialize()] === undefined) {
          throw new Error("Account not opened");
        }
        this.state[event.payload.accountId.serialize()] += event.payload.amount;
      },
      locks: (event: Deposited) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          eventId: event.id.serialize(),
        });
      },
    },
    [Withdrawn.name]: {
      handle: async (event: Withdrawn) => {
        console.log("before suspend", event.toString());
        await this.suspend(event);
        console.log("after suspend", event.toString());
        if (this.state[event.payload.accountId.serialize()] === undefined) {
          throw new Error("Account not opened");
        }
        this.state[event.payload.accountId.serialize()] += event.payload.amount;
      },
      locks: (event: Withdrawn) => {
        return new Lock({
          accountId: event.payload.accountId.serialize(),
          eventId: event.id.serialize(),
        });
      },
    },
  };

  onDeposited(event: Deposited) {
    this.state[event.payload.accountId.serialize()] += event.payload.amount;
  }

  onWithdrawn(event: Withdrawn) {
    this.state[event.payload.accountId.serialize()] -= event.payload.amount;
  }
}
