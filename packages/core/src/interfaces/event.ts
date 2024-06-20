import type { Identifier } from "./identifiable";

export interface IEvent<Name extends string = string, Payload = any> {
  id: Identifier;
  name: Name;
  payload: Payload;
}
