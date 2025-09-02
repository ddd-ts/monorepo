import { MicrosecondTimestamp } from "@ddd-ts/shape";
import { EventId } from "../components/event-id";
import type { IEvent } from "./event";

export type IFact<T extends IEsEvent = IEsEvent> = T & {
  ref: string;
  revision: number;
  occurredAt: MicrosecondTimestamp;
};

export type IChange<T extends IEsEvent = IEsEvent> = T & {
  revision: undefined;
  occurredAt: undefined;
};

export type ISavedChange<T extends IEsEvent = IEsEvent> = T & {
  ref: string;
  revision: number;
  occurredAt: undefined;
};

export interface IEsEvent<Name extends string = string, Payload = any>
  extends IEvent<Name, Payload> {
  id: EventId;
  ref?: string;
  occurredAt?: MicrosecondTimestamp;
  revision?: number;
}

export interface ISerializedEvent {
  $name: string;
  name: string;
  id: string;
  ref?: string;
  occurredAt?: MicrosecondTimestamp;
  revision?: number;
  payload: any;
  version: number;
}

export interface ISerializedChange {
  $name: string;
  name: string;
  id: string;
  revision?: number;
  payload: any;
  version: number;
}

export interface ISerializedSavedChange {
  $name: string;
  name: string;
  id: string;
  ref: string;
  occurredAt: undefined;
  revision: number;
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
