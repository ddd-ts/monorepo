import { ImplementsTrait } from "@ddd-ts/traits";
import { EventId } from "../components/event-id";
import { IEsEvent } from "../interfaces/es-event";
import { Lock } from "./lock";
import { WithClaimTimeout } from "./handlers/timeout.handler";
import { WithIsolateAfter, WithSkipAfter } from "./handlers/retry.handler";
import { INamed } from "../interfaces/named";
import { Constructor } from "@ddd-ts/types";
import { ProjectedStream } from "../components/projected-stream";
import { CheckpointId } from "./checkpoint";

interface IESProjectionHandler<E extends IEsEvent, C> {
  process(events: E[], context: C): Promise<EventId[]>;
  locks(event: E): Lock;
}

export abstract class ESProjection<E extends IEsEvent, C = any> {
  handlers: Record<string, IESProjectionHandler<E, C>> = {};

  registerHandler<N extends string, T extends Constructor<E> & INamed<string>>(
    event: INamed<N>,
    handler: IESProjectionHandler<InstanceType<T>, C>,
  ) {
    if (this.handlers[event.$name]) {
      throw new Error(`Handler for event ${event.$name} already registered`);
    }
    this.handlers[event.$name] = handler as IESProjectionHandler<E, C>;
  }

  abstract getSource(event: E): ProjectedStream;
  abstract getCheckpointId(event: E): CheckpointId;

  getHandler<T extends E>(event: T) {
    const handler = this.handlers[event.name];
    if (!handler) {
      throw new Error(`No handler for event ${event.name}`);
    }
    return handler as IESProjectionHandler<T, C>;
  }

  getTaskSettings(event: E) {
    const handler = this.getHandler(event) as IESProjectionHandler<E, C> &
      Partial<
        ImplementsTrait<ReturnType<typeof WithClaimTimeout>> &
          ImplementsTrait<ReturnType<typeof WithIsolateAfter>> &
          ImplementsTrait<ReturnType<typeof WithSkipAfter>>
      >;

    return {
      lock: handler.locks(event),
      claimTimeout: handler.getClaimTimeout?.(event) || 1000 * 60,
      skipAfter: handler.getSkipAfter?.(event) || 10,
      isolateAfter: handler.getIsolateAfter?.(event) || 7,
    };
  }

  process(events: E[], context: C): Promise<EventId[]> {
    const byEvent = events.reduce(
      (acc, event) => {
        const name = event.name;
        if (!acc[name]) {
          acc[name] = [];
        }
        acc[name].push(event);
        return acc;
      },
      {} as Record<string, E[]>,
    );

    const promises = Object.entries(byEvent).map(async ([name, events]) => {
      const handler = this.handlers[name];
      if (!handler) {
        throw new Error(`No handler for event ${name}`);
      }
      return handler.process(events, context);
    });

    return Promise.all(promises).then((results) =>
      results.flat().filter((e) => !!e),
    );
  }
}
