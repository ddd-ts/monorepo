import { Primitive } from "@ddd-ts/shape";
import { customAlphabet } from "nanoid";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const generate = customAlphabet(alphabet, 24);

export class EventId extends Primitive(String) {
  toString() {
    return this.value;
  }

  static generate() {
    return new EventId(generate());
  }
}
