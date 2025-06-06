import { EventId, EventReference } from "../components/event-id";
import type { IEvent } from "./event";

export type IFact<T extends IEsEvent = IEsEvent> = T & {
  ref: EventReference;
  revision: number;
  occurredAt: Date;
};

export type IChange<T extends IEsEvent = IEsEvent> = T & {
  revision: undefined;
  occurredAt: undefined;
};

export interface IEsEvent<Name extends string = string, Payload = any>
  extends IEvent<Name, Payload> {
  id: EventId;
  occurredAt?: Date;
  revision?: number;
}

export interface ISerializedEvent {
  $name: string;
  name: string;
  id: string;
  occurredAt?: Date;
  revision?: number;
  payload: any;
  version: number;
}

export interface ISerializedChange {
  $name: string;
  name: string;
  id: string;
  occurredAt: undefined;
  revision: undefined;
  payload: any;
  version: number;
}

export interface ISerializedFact {
  $name: string;
  name: string;
  id: string;
  ref: string;
  occurredAt: Date;
  revision: number;
  payload: any;
  version: number;
}
