import { Serializer } from "@ddd-ts/event-sourcing";
import { Cashflow } from "../domain/cashflow/cashflow";

export class CashflowSerializer extends Serializer({
  serialize: (model: Cashflow) => ({ id: model.id, flow: model.flow }),
  deserialize: (serialized) => new Cashflow(serialized.id, serialized.flow),
  getIdFromModel: (model) => model.id,
}) {}

namespace Serializar {
  export abstract class Class<Model> {
    abstract serialize(model: Model): any;
    abstract deserialize(serialized: ReturnType<this["serialize"]>): Model;
    abstract getIdFromModel(model: Model): string;
  }

  export type Serialized<This extends Serializar.Class<any>> = ReturnType<
    This["serialize"]
  >;
}

class CashflowSerializer2 extends Serializar.Class<Cashflow> {
  serialize(model: Cashflow) {
    return { id: model.id, flow: model.flow };
  }
  deserialize(serialized: Serializar.Serialized<this>) {
    return new Cashflow(serialized.id, serialized.flow);
  }
  getIdFromModel(model: Cashflow) {
    return model.id;
  }
}
