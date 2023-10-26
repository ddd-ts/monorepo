import { Serializer, Serialized } from "@ddd-ts/serialization";
import { Cashflow } from "../domain/read/cashflow/cashflow";

export class CashflowSerializer extends Serializer(Cashflow, 1n) {
  serialize(model: Cashflow) {
    return { id: model.id, flow: model.flow, version: this.version };
  }
  deserialize(serialized: Serialized<this>) {
    return new Cashflow(serialized.id, serialized.flow);
  }
}
