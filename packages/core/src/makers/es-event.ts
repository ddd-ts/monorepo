import {
  Optional,
  Shape,
  type DefinitionOf,
  type DictShorthand,
} from "@ddd-ts/shape";
import { type Constructor } from "@ddd-ts/types";
import { EventId } from "../components/event-id";

export const EsEvent = <
  const Name extends string,
  const Payload extends DictShorthand,
>(
  name: Name,
  payload: Payload,
) => {
  abstract class $EsEvent {
    static name = name;
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
  }

  return Shape(
    {
      name,
      id: EventId,
      payload,
      revision: Optional(Number),
      occurredAt: Optional(Date),
    },
    $EsEvent,
  );
};
