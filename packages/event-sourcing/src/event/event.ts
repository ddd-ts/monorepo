export type Fact<T extends Event = Event> = T & {
  revision: bigint;
};

export type Change<T extends Event = Event> = T & {
  revision: undefined;
};

export type Serializable =
  | { [key: string | number]: string | number | boolean | Serializable }
  | Serializable[];

export type Event = {
  id: string;
  type: string;
  revision?: bigint;
  payload: Serializable;
};
