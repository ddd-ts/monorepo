import type { Constructor } from "@ddd-ts/types";
import type { IEvent } from "./event";

export interface IEventBus {
  on<E extends IEvent>(
    event: Constructor<E>,
    handler: (event: E) => Promise<void>,
  ): void;

  off<E extends IEvent>(
    event: Constructor<E>,
    handler: (event: E) => Promise<void>,
  ): void;

  publish(event: IEvent): Promise<void>;
}
