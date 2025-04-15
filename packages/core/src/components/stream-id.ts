import { Primitive } from "@ddd-ts/shape";

export class LakeId extends Primitive(String) {
  get shardType() {
    return this.value.split("-")[0];
  }

  get shardId() {
    return this.value.split("-")[1];
  }

  static from(shardType: string, shardId: string) {
    return new LakeId(`${shardType}-${shardId}`);
  }
}

export class StreamId extends Primitive(String) {
  get aggregateType() {
    return this.value.split("-")[0];
  }

  get aggregateId() {
    return this.value.split("-")[1];
  }

  static from(aggregateType: string, aggregateId: string) {
    return new StreamId(`${aggregateType}-${aggregateId}`);
  }
}