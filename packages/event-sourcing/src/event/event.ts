export type Fact<T extends Event> = T & { revision: bigint };
export type Change<T extends Event> = T & { revison: undefined };

export type Event = {
  id: string;
  type: string;
  revision?: bigint;
};
