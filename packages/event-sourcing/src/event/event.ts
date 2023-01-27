// export type Fact<T extends Event = Event> = T & {
//   revision: bigint;
// };

import { v4 } from "uuid";
import { Constructor } from "../index";

// export type Change<T extends Event = Event> = T & {
//   revision: undefined;
// };

export type Serializable =
  | { [key: string | number]: string | number | boolean | Serializable }
  | Serializable[];

// export type Event = {
//   id: string;
//   type: string;
//   revision?: bigint;
//   payload: Serializable;
// };
export type Fact<T extends Event = Event> = T & {
  revision: bigint;
};

export type Change<T extends Event = Event> = T & {
  revision: undefined;
};

export abstract class Event<Payload = {}> {
  revision?: bigint;
  id = v4();
  type = this.constructor.name;
  constructor(public readonly payload: Payload) {}

  static new<T extends Constructor<Event<any>>>(
    this: T,
    payload: InstanceType<T>["payload"]
  ) {
    const change = new this(payload) as Change<InstanceType<T>>;
    return change;
  }

  static asFact<T extends Constructor<Event<any>>>(
    this: T,
    payload: InstanceType<T>["payload"],
    revision: bigint
  ) {
    const fact = new this(payload) as Fact<InstanceType<T>>;
    fact.revision = revision;
    return fact;
  }
}
