export type Identifier<T extends string = string> = { serialize(): T };

export interface IIdentifiable {
  id: Identifier;
}
