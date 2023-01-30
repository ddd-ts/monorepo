import { Event } from "./event";

export abstract class EventSerializer<E extends Event> {
  abstract serialize(event: E): { id: string };
  abstract deserialize(serialized: ReturnType<this["serialize"]>): E;
}
