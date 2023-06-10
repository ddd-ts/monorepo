import { Serializer, Serialized } from "@ddd-ts/model";
import { Cashflow } from "../domain/read/cashflow/cashflow";

export class CashflowSerializer extends Serializer<Cashflow> {
  version = 1n;
  async serialize(model: Cashflow) {
    return { id: model.id, flow: model.flow, version: this.version };
  }
  async deserialize(serialized: Serialized<this>) {
    return new Cashflow(serialized.id, serialized.flow);
  }
}
