import { Primitive } from "@ddd-ts/shape";

export class StableId extends Primitive(String) {
  static globalseed = Math.random().toString(36).substring(2, 5);
  static current = 0;

  static testseeds = new Map<any, number>();

  static generate(test: string) {
    const seed = StableId.testseeds.get(test) || 1;
    StableId.testseeds.set(test, seed + 1);
    return new StableId(`${StableId.globalseed}-${test}-${seed}`);
  }
}
