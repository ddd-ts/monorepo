import { TransactionPerformer } from "@ddd-ts/model";
import { EsProjectedStreamReader } from "../../es-aggregate-store/es-projected-stream.reader";
import { Competitor, EsEvent } from "../../es-aggregate-store/event-store";
import { Event } from "../../event/event";
import { Checkpoint } from "../checkpoint/checkpoint";
import { Projection } from "../projection";

import { Projector } from "./projector";

/**
 * DistributedProjector:
 *
 * To use when the read models are persisted within a database accessible multiple workloads.
 *
 * Allows to load balance the Projection hydratation among multiple workloads.
 * Will compete for events and catch up from the latest checkpoint to the end of the stream.
 */
export class DistributedProjector<P extends Projection> implements Projector {
  competitor?: Competitor;

  constructor(
    private readonly projection: P,
    private readonly reader: EsProjectedStreamReader<P["on"]>,
    private readonly checkpoint: Checkpoint,
    private readonly transaction: TransactionPerformer // private readonly logger: LoggerService,
  ) {}

  logger = {
    info: (a: any, b: any) => {
      //console.log(a)
    },
    warn: (a: any, b: any) => {
      //console.warn(a);
    },
  };

  get logs() {
    const { name, streams } = this.projection.configuration;

    const stream = streams.map((s) => s.name).join(", ");
    const meta = { projection: name, stream };

    type E = EsEvent;

    const p = `DistributedProjection.${name}(${stream})`;
    const e = (e: EsEvent) => `Event.${e.type}(${e.id})[${e.revision}n]`;

    return {
      init: () => {
        this.logger.info(`${p} initializing`, { ...meta });
      },
      listen: () => {
        this.logger.info(`${p} listening`, { ...meta });
      },
      stop: () => {
        this.logger.info(`${p} stopping`, { ...meta });
      },
      stopped: () => {
        this.logger.info(`${p} stopped`, { ...meta });
      },
      catchUp: (checkpoint: bigint) => {
        this.logger.info(`${p} catching up from revision ${checkpoint}n`, {
          ...meta,
          checkpoint,
        });
      },
      project: (event: E, checkpoint: bigint) => {
        this.logger.info(`${p} projecting ${e(event)}`, {
          ...meta,
          event,
          checkpoint,
        });
      },
      onAttempt: (event: E) => {
        this.logger.info(`${p} received ${e(event)} `, { ...meta, event });
      },
      onSuccess: (event: E) => {
        this.logger.info(`${p} successfully handled ${e(event)}`, {
          ...meta,
          event,
        });
      },
      onRetry: (event: E, error: Error) => {
        this.logger.warn(`${p} failed to handle ${e(event)}, retrying`, {
          ...meta,
          event,
          error,
        });
      },
    };
  }

  // get logs() {
  //   type E = Indexed<SerializedEvent>;

  //   const { name, AGGREGATE } = this.projection.configuration;
  //   const meta = { projection: name, stream };

  //   const p = `DistributedProjection.${name}(${stream})`;
  //   const e = (e: E) => `Event.${e.type}(${e.id})[${e.revision}n]`;

  //   return {
  //     init: () => {
  //       this.logger.info(`${p} initializing`, { ...meta });
  //     },
  //     listen: () => {
  //       this.logger.info(`${p} listening`, { ...meta });
  //     },
  //     stop: () => {
  //       this.logger.info(`${p} stopping`, { ...meta });
  //     },
  //     stopped: () => {
  //       this.logger.info(`${p} stopped`, { ...meta });
  //     },
  //     catchUp: (checkpoint: bigint) => {
  //       this.logger.info(`${p} catching up from revision ${checkpoint}n`, {
  //         ...meta,
  //         checkpoint,
  //       });
  //     },
  //     project: (event: E, checkpoint: bigint) => {
  //       this.logger.info(`${p} projecting ${e(event)}`, {
  //         ...meta,
  //          event,
  //         error,
  //       });
  //     },
  //   };
  // }  event,
  //         checkpoint,
  //       });
  //     },
  //     onAttempt: (event: E) => {
  //       this.logger.info(`${p} received ${e(event)} `, { ...meta, event });
  //     },
  //     onSuccess: (event: E) => {
  //       this.logger.info(`${p} successfully handled ${e(event)}`, {
  //         ...meta,
  //         event,
  //       });
  //     },
  //     onRetry: (event: E, error: Error) => {
  //       this.logger.warn(`${p} failed to handle ${e(event)}, retrying`, {
  //         ...meta,
  //

  async start() {
    const { name, streams } = this.projection.configuration;

    this.logs.init();

    this.competitor = await this.reader.compete(streams, name);

    this.logs.listen();

    for await (const event of this.competitor) {
      this.logs.onAttempt(event.fact);
      // optim => try and use the new event directly
      try {
        await this.catchUp();
        await event.succeed();
        this.logs.onSuccess(event.fact);
      } catch (error) {
        await event.retry();
        this.logs.onRetry(event.fact, error as any);
      }
    }
  }

  async stop() {
    this.logs.stop();
    await this.competitor?.close();
    this.logs.stopped();
  }

  async catchUp() {
    const checkpoint = await this.checkpoint.get(
      this.projection.configuration.name
    );

    this.logs.catchUp(checkpoint);

    for await (const event of this.reader.read(
      this.projection.configuration.streams,
      checkpoint + 1n
    )) {
      this.logs.project(event, checkpoint);

      await this.transaction.perform(async (trx) => {
        await this.projection.project(event as any, trx);
        await this.checkpoint.set(
          this.projection.configuration.name,
          event.revision as any,
          trx
        );
      });
    }
  }
}
