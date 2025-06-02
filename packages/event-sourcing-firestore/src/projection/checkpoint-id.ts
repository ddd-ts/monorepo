import { Shape } from "../../../shape/dist";

export class ProjectionCheckpointId extends Shape(String) {
  static separator = "@@";

  static from(name: string, shardValue: { serialize: () => string }) {
    const id = `${name}${ProjectionCheckpointId.separator}${shardValue.serialize()}`;
    return new ProjectionCheckpointId(id);
  }
}
