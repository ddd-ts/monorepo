import type { Constructor } from "@ddd-ts/types";
import type { IEvent } from "./event";

export interface IProjection {
  on: Constructor<IEvent>[];

  handle(event: IEvent): any;
}
