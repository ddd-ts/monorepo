import { ImplementsTrait } from "@ddd-ts/traits";
import { CashflowOnOpenedHandler } from "./cashflow.projection.OnOpened";
import { CashflowOnFlowHandler } from "./cashflow.projection.OnFlow";
import { CashflowOnRenamedHandler } from "./cashflow.projection.OnRenamed";
import {
  Account,
  AccountOpened,
  AccountRenamed,
  Deposited,
  Withdrawn,
} from "../account/account";
import { StableId } from "../account/stable-id";
import { TransactionPerformer } from "../../../components/transaction";
import { IEsEvent } from "../../../interfaces/es-event";
import { Handler } from "../../handlers";
import {
  ProjectedStream,
  StreamSource,
} from "../../../components/projected-stream";
import { ESProjection } from "../../projection";
import { CashflowStore } from "./cashflow.store";
import { CheckpointId } from "../../checkpoint";

export class CashflowStream extends ProjectedStream {
  constructor() {
    super({
      sources: [
        new StreamSource({
          aggregateType: Account.name,
          shardKey: "accountId",
          events: [
            AccountOpened.name,
            Deposited.name,
            Withdrawn.name,
            AccountRenamed.name,
          ],
        }),
      ],
    });
  }
}

export class CashflowProjection extends ESProjection<
  AccountOpened | Deposited | Withdrawn | AccountRenamed
> {
  source = new CashflowStream();

  constructor(
    transaction: TransactionPerformer,
    public readonly store: CashflowStore,
  ) {
    super();

    this.registerHandler(
      AccountOpened,
      new CashflowOnOpenedHandler({ store, transaction }),
    );

    this.registerHandler(
      Deposited,
      new CashflowOnFlowHandler({ store, transaction }),
    );

    this.registerHandler(
      Withdrawn,
      new CashflowOnFlowHandler({ store, transaction }),
    );

    this.registerHandler(
      AccountRenamed,
      new CashflowOnRenamedHandler({ store, transaction }),
    );
  }

  getSource(
    event: AccountOpened | Deposited | Withdrawn | AccountRenamed,
  ): ProjectedStream {
    return this.source;
  }

  getCheckpointId(
    event: AccountOpened | Deposited | Withdrawn | AccountRenamed,
  ): CheckpointId {
    return CheckpointId.from("Cashflow", event.payload.accountId);
  }

  get testhandlers() {
    return this.handlers as {
      [K in AccountOpened["name"]]: CashflowOnOpenedHandler;
    } & {
      [K in Deposited["name"]]: CashflowOnFlowHandler;
    } & {
      [K in Withdrawn["name"]]: CashflowOnFlowHandler;
    } & {
      [K in AccountRenamed["name"]]: CashflowOnRenamedHandler;
    };
  }

  async suspend(
    event: IEsEvent,
  ): ReturnType<ImplementsTrait<typeof Handler.Suspense>["suspend"]> {
    const handler = (this.handlers as any)[event.name] as any;
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }
    try {
      return await handler.suspend(event);
    } catch (error) {
      if (error instanceof Error) {
        Error.captureStackTrace(error, this.suspend);
      }
      throw error;
    }
  }

  resume(
    event: IEsEvent,
  ): ReturnType<ImplementsTrait<typeof Handler.Suspense>["resume"]> {
    const handler = (this.handlers as any)[event.name] as any;
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }
    return handler.resume(event);
  }

  fail(
    event: IEsEvent,
    error?: any,
  ): ReturnType<ImplementsTrait<typeof Handler.Suspense>["fail"]> {
    const handler = (this.handlers as any)[event.name] as any;
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }
    return handler.fail(event, error);
  }

  markFailing(event: IEsEvent) {
    const handler = (this.handlers as any)[event.name] as any;
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }

    return handler.markFailing(event);
  }

  print(test: string) {
    const memory = Object.entries(this.handlers).map(([name, handler]) => {
      const memory = (handler as any).prettyMemory();
      if (memory.length === 0) {
        return "";
      }
      return `${name}: \n\t${memory.join("\n\t")}`;
    });

    const printed = `\n${memory.filter(Boolean).join("\n")}\n`;

    return printed
      .replaceAll("seed", "")
      .replaceAll(test, "")
      .replaceAll(StableId.globalseed, "")
      .replaceAll("--", "-");
  }

  async tick() {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // getLock(event: IEsEvent): Lock {
  //   const handler = (this.handlers as any)[event.name] as any;
  //   if (!handler) {
  //     throw new Error(`No handler for event ${event.name}`);
  //   }
  //   return handler.locks(event);
  // }

  // async process(
  //   checkpointId: CheckpointId,
  //   events: IFact[],
  //   context: {
  //     onProcessed: (
  //       checkpointId: CheckpointId,
  //       processed: EventId[],
  //       context: {
  //         checkpointId: CheckpointId;
  //         transaction?: FirestoreTransaction;
  //       },
  //     ) => void;
  //   },
  // ) {
  //   const byEvent = events.reduce(
  //     (acc, event) => {
  //       const name = event.name;
  //       if (!acc[name]) {
  //         acc[name] = [];
  //       }
  //       acc[name].push(event as IEsEvent);
  //       return acc;
  //     },
  //     {} as Record<string, IEsEvent[]>,
  //   );

  //   const promises = Object.entries(byEvent).map(async ([name, events]) => {
  //     const handler = (this.handlers as any)[name] as any;

  //     if (!handler) {
  //       throw new Error(`No handler for event ${name}`);
  //     }

  //     console.log(`Processing ${events.length} events of type ${name}`);
  //     const processed = await handler.process(events as any, {
  //       checkpointId,
  //       onProcessed: context.onProcessed,
  //     });

  //     return (processed as any[]).filter((e) => !!e);
  //   });

  //   const all = await Promise.all(promises);

  //   return all.flat() as EventId[];
  // }
}
