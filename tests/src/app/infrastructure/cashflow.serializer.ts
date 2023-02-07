import { Serializer, Serialized } from "@ddd-ts/model";
import { Cashflow } from "../domain/read/cashflow/cashflow";

export class CashflowSerializer extends Serializer<Cashflow> {
  async serialize(model: Cashflow) {
    return { id: model.id, flow: model.flow };
  }
  async deserialize(serialized: Serialized<this>) {
    return new Cashflow(serialized.id, serialized.flow);
  }
  getIdFromModel(model: Cashflow) {
    return model.id;
  }

  getIdFromSerialized(serialized: Serialized<this>) {
    return serialized.id;
  }
}