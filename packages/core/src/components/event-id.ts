import { Primitive } from "@ddd-ts/shape";
import { customAlphabet } from "nanoid";
import type { Identifier } from "../interfaces/identifiable";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const generate = customAlphabet(alphabet, 24);

export class EventId extends Primitive(String) implements Identifier {
  toString() {
    return this.value;
  }

  static generate() {
    return new EventId(generate());
  }

  equals(other: EventId) {
    return this.value === other.value;
  }
}

export class EventReference extends Primitive(String) {
  toString() {
    return this.value;
  }
}
