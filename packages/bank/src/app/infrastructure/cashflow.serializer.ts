import { Serializer, Serialized } from "@ddd-ts/event-sourcing";
import { Cashflow } from "../domain/cashflow/cashflow";

export class CashflowSerializer extends Serializer<Cashflow> {
  serialize(model: Cashflow) {
    return { id: model.id, flow: model.flow };
  }
  deserialize(serialized: Serialized<this>) {
    return new Cashflow(serialized.id, serialized.flow);
  }
  getIdFromModel(model: Cashflow) {
    return model.id;
  }
}
