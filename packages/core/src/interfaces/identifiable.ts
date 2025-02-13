export type Identifier = { serialize(): string };

export interface IIdentifiable {
  id: Identifier;
}
