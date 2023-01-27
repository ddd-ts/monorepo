import { EsProjectedStreamReader } from "../../es-aggregate-store/es-projected-stream.reader";
import { Follower } from "../../es-aggregate-store/event-store";
import { Checkpoint } from "../checkpoint/checkpoint";
import { Projection } from "../projection";
import { TransactionPerformer } from "../transaction/transaction";
import { Projector } from "./projector";

/**
 * IsolatedProjector:
 *
 * To use when the read models are persisted within a database accessible only by one workload (such as an in-memory store)
 *
 * Will subscribe to all new events and catch up from the latest checkpoint to the end of the stream.
 * (In the case of an in-memory store, this will catchup from the beginning of the stream.)
 */
export class IsolatedProjector implements Projector {
  follower?: Follower;

  // logger = console;
  logger = {
    info: (a: any, b: any) => {
      //console.log(a)
    },
    warn: (a: any, b: any) => {
      //console.warn(a);
    },
  };

  constructor(
    private readonly projection: Projection,
    private readonly reader: EsProjectedStreamReader,
    private readonly checkpoint: Checkpoint,
    private readonly transaction: TransactionPerformer // private readonly logger: LoggerService
  ) {}

  get logs() {
    // type E = Indexed<SerializedEvent>;

    const { name, streams } = this.projection.configuration;
    const stream = streams.map((s) => s.name).join(", ");
    const meta = { projection: name, stream };

    const p = `IsolatedProjection.${name}(${stream})`;
    const e = (e: any) => `Event.${e.type}(${e.id})[${e.revision}n]`;

    return {
      init: () => {
        this.logger.info(`${p} initializing`, { ...meta });
      },
      listen: (checkpoint: bigint) => {
        this.logger.info(`${p} listening from revision ${checkpoint}n`, {
          ...meta,
        });
      },
      stop: () => {
        this.logger.info(`${p} stopping`, { ...meta });
      },
      stopped: () => {
        this.logger.info(`${p} stopped`, { ...meta });
      },
      project: (event: any, checkpoint: bigint) => {
        this.logger.info(`${p} projecting ${e(event)}`, {
          ...meta,
          event,
          checkpoint,
        });
      },
      onSuccess: (event: any) => {
        this.logger.info(`${p} successfully handled ${e(event)}`, {
          ...meta,
          event,
        });
      },
      onFail: (event: any, error: Error) => {
        this.logger.warn(`${p} failed to handle ${e(event)}, exiting`, {
          ...meta,
          event,
          error,
        });
      },
    };
  }

  async start() {
    const { name, streams } = this.projection.configuration;

    this.logs.init();

    const checkpoint = await this.checkpoint.get(name);

    this.follower = await this.reader.follow(streams, checkpoint + 1n);

    this.logs.listen(checkpoint);

    (async () => {
      if (!this.follower) {
        throw new Error("follower is undefined");
      }
      for await (const event of this.follower) {
        try {
          this.logs.project(event, checkpoint);
          await this.transaction.perform(async (trx) => {
            await this.projection.project(event, trx);
            await this.checkpoint.set(name, event.revision, trx);
          });
          this.logs.onSuccess(event);
        } catch (error) {
          if (error instanceof Error) {
            this.logs.onFail(event, error);
            throw new Error("Projection failed " + error.message);
          } else {
            throw new Error("Projection failed " + error);
          }
        }
      }
    })();
  }

  async stop() {
    this.logs.stop();
    await this.follower?.close();
    this.follower = undefined;
    this.logs.stopped();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
