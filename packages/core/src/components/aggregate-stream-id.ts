import { Shape } from "@ddd-ts/shape";

export class AggregateStreamId extends Shape({
  aggregate: String,
  id: String,
}) {}
