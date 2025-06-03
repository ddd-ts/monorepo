import { Shape } from "../../../shape/dist";

export class CheckpointId extends Shape(String) {
  static separator = "@@";

  static from(name: string, shardValue: { serialize: () => string }) {
    const id = `${name}${CheckpointId.separator}${shardValue.serialize()}`;
    return new CheckpointId(id);
  }
}
