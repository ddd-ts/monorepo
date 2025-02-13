import type { IEvent } from "./event";

export type IFact<T extends IEsEvent = IEsEvent> = T & {
  revision: number;
  occurredAt: Date;
};

export type IChange<T extends IEsEvent = IEsEvent> = T & {
  revision: undefined;
  occurredAt: undefined;
};

export interface IEsEvent<Name extends string = string, Payload = any>
  extends IEvent<Name, Payload> {
  occurredAt?: Date;
  revision?: number;
}

export interface ISerializedEvent {
  $kind: string;
  name: string;
  id: string;
  occurredAt?: Date;
  revision?: number;
  payload: any;
  version: number;
}

export interface ISerializedChange {
  $kind: string;
  name: string;
  id: string;
  occurredAt: undefined;
  revision: undefined;
  payload: any;
  version: number;
}

export interface ISerializedFact {
  $kind: string;
  name: string;
  id: string;
  occurredAt: Date;
  revision: number;
  payload: any;
  version: number;
}
