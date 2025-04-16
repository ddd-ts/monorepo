import {
  Optional,
  Shape,
  type DefinitionOf,
  type DictShorthand,
} from "@ddd-ts/shape";
import { type Constructor } from "@ddd-ts/types";
import { EventId } from "../components/event-id";
import { WithDerivations } from "@ddd-ts/traits";
import { Named } from "../traits/named";
import { ISerializedChange, ISerializedFact } from "../interfaces/es-event";

export const EsEvent = <
  const Name extends string,
  const Payload extends DictShorthand,
>(
  name: Name,
  payload: Payload,
) => {
  abstract class $EsEvent {
    static new<TH extends Constructor>(
      this: TH,
      payload: DefinitionOf<Payload>["$inline"],
    ) {
      return new this({
        name,
        id: EventId.generate(),
        payload,
      }) as InstanceType<TH>;
    }

    serializeChange<T extends { serialize: () => any }>(this: T): ReturnType<T["serialize"]> & ISerializedChange {
      return this.serialize();
    }

    serializeFact<T extends { serialize: () => any }>(this: T): ReturnType<T["serialize"]> & ISerializedFact {
      return this.serialize();
    }
  }

  return Shape(
    {
      name,
      id: EventId,
      payload,
      revision: Optional(Number),
      occurredAt: Optional(Date),
      ref: Optional(String),
    },
    WithDerivations($EsEvent, Named(name)),
  );
};
