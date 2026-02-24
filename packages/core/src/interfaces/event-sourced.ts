import type { IEsEvent } from "./es-event";

export interface IEventSourced<E extends IEsEvent = IEsEvent> {
  changes: E[];
  acknowledgedRevision: number;
  load(fact: E): void;
  apply(change: E): void;
  clearChanges(): void;
  acknowledgeChanges(): void;
}
