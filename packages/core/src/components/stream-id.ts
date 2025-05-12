import { Primitive } from "@ddd-ts/shape";
import { Constructor } from "@ddd-ts/types";

export class PairId extends Primitive(String) {
  static separator = "@@" as const;
  get separator() {
    return (this.constructor as any).separator;
  }

  get left() {
    return this.value.split(this.separator)[0];
  }

  get right() {
    return this.value.split(this.separator)[1];
  }

  static from<T extends Constructor<PairId> & { separator: string }>(
    this: T,
    left: string,
    right: string,
  ) {
    if (left.includes(this.separator) || right.includes(this.separator)) {
      throw new Error(`Invalid Id: ${left}${this.separator}${right}`);
    }
    const result = new this(`${left}${this.separator}${right}`);
    result.ensureValidity();
    return result as InstanceType<T>;
  }

  static parse<T extends Constructor<PairId> & { separator: string }>(
    this: T,
    value: string,
  ) {
    const parts = value.split(this.separator);
    if (parts.length !== 2) {
      throw new Error(`Invalid Id: ${value}`);
    }
    const [left, right] = parts;
    const result = new this(`${left}${this.separator}${right}`);
    result.ensureValidity();
    return result as InstanceType<T>;
  }

  ensureValidity() {
    const [left, right] = this.value.split(this.separator);
    if (!left || !right) {
      throw new Error(`Invalid Id: ${this.value}`);
    }
    if (left.includes(this.separator) || right.includes(this.separator)) {
      throw new Error(`Invalid Id: ${this.value}`);
    }
  }
}

export class LakeId extends PairId {
  get shardType() {
    return this.left;
  }

  get shardId() {
    return this.right;
  }
}

export class StreamId extends PairId {
  get aggregateType() {
    return this.left;
  }

  get aggregateId() {
    return this.right;
  }
}
