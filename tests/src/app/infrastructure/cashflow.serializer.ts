import { Serialized, type ISerializer } from "@ddd-ts/core";
import { Cashflow } from "../domain/read/cashflow/cashflow";

export class CashflowSerializer implements ISerializer<Cashflow> {
  serialize(model: Cashflow) {
    return { id: model.id, flow: model.flow, version: 1 };
  }
  deserialize(serialized: Serialized<this>) {
    return new Cashflow(serialized.id, serialized.flow);
  }
}
