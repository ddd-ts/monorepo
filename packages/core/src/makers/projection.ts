import type { Constructor } from "@ddd-ts/types";
import { Derive } from "@ddd-ts/traits";

import type { IProjection } from "../interfaces/projection";
import type { IEvent } from "../interfaces/event";
import { getHandler } from "../decorators/handlers";
import { Named } from "./named";

export const Projection = <
  Name extends string,
  On extends Constructor<IEvent>[],
>(
  name: Name,
  on: On,
) => {
  type Event = InstanceType<On[number]>;

  return class $Projection extends Derive(Named(name)) implements IProjection {
    on = on;

    handle(event: Event) {
      const handler = getHandler(this, event.name);
      if (!handler) {
        throw new Error(`No handler for event ${event.name}`);
      }
      return handler.apply(this, [event]);
    }
  };
};
