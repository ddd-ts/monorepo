import { Primitive } from "@ddd-ts/shape";
import { v4 } from "uuid";

export class EventId extends Primitive(String) {
  toString() {
    return this.value;
  }

  static generate() {
    return new EventId(v4());
  }
}
