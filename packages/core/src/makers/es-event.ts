import {
  Optional,
  Shape,
  type DefinitionOf,
  type DictShorthand,
  MicrosecondTimestamp,
} from "@ddd-ts/shape";
import { type Constructor } from "@ddd-ts/types";
import { EventId } from "../components/event-id";
import { Derive, WithDerivations } from "@ddd-ts/traits";
import { Named } from "../traits/named";
import { Shaped } from "../traits/shaped";

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
  }

  return WithDerivations(
    $EsEvent,
    Named(name),
    Shaped({
      name,
      $name: name,
      id: EventId,
      payload,
      revision: Optional(Number),
      occurredAt: Optional(MicrosecondTimestamp),
      ref: Optional(String),
    }),
  );

  // return Shape(
  //   {
  //     name,
  //     id: EventId,
  //     payload,
  //     revision: Optional(Number),
  //     occurredAt: Optional(MicrosecondTimestamp),
  //   },
  //   WithDerivations($EsEvent, Named(name)),
  // );
};
