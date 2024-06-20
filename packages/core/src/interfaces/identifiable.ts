export type Identifier = { toString(): string };

export interface IIdentifiable {
  id: Identifier;
}
