import { Shape } from "@ddd-ts/shape";

export class CheckpointId extends Shape(String) {
  static separator = "@@";

  shard() {
    const [name, shard] = this.value.split(CheckpointId.separator);
    if (!name || !shard) {
      throw new Error(`Invalid CheckpointId format: ${this.value}`);
    }
    return shard;
  }

  static from(name: string, shardValue: { serialize: () => string }) {
    const id = `${name}${CheckpointId.separator}${shardValue.serialize()}`;
    return new CheckpointId(id);
  }

  equals(other: CheckpointId): boolean {
    return this.value === other.value;
  }
}
