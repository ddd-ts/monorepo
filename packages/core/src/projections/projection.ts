import { ImplementsTrait } from "@ddd-ts/traits";
import { EventId } from "../components/event-id";
import { IEsEvent } from "../interfaces/es-event";
import { Lock } from "./lock";
import { INamed } from "../interfaces/named";
import { Constructor } from "@ddd-ts/types";
import { ProjectedStream } from "../components/projected-stream";
import { CheckpointId } from "./checkpoint";
import {
  WithClaimTimeout,
  WithIsolateAfter,
  WithSkipAfter,
} from "./handlers/settings.handle";

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
      claimTimeout: handler.getClaimTimeout?.(event) ?? 1000 * 60,
      skipAfter: handler.getSkipAfter?.(event) ?? 10,
      isolateAfter: handler.getIsolateAfter?.(event) ?? 3,
    };
  }

  async process(events: E[], context: C): Promise<EventId[]> {
    const eventIds: EventId[] = [];

    for (const [name, batch] of batched(events)) {
      const handler = this.handlers[name];
      if (!handler) throw new Error(`No handler for event ${name}`);
      const ids = await handler.process(batch, context);
      eventIds.push(...ids);
    }

    return eventIds;
  }
}

function* batched<U extends string, T extends IEsEvent<U>>([
  first,
  ...rest
]: T[]) {
  let current = first;
  let batch = [first];
  for (const event of rest) {
    if (event.name === current.name) {
      batch.push(event);
    } else {
      yield [current.name, batch] as const;
      current = event;
      batch = [event];
    }
  }
  yield [current.name, batch] as const;
}
