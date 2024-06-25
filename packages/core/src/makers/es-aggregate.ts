import { Derive } from "@ddd-ts/traits";
import type { Constructor } from "@ddd-ts/types";

import { EventSourced } from "../traits/event-sourced";
import type { IEsEvent } from "../interfaces/es-event";
import { Named } from "../traits/named";
import { Shape, type DictShorthand } from "@ddd-ts/shape";
import { Identifiable } from "../traits/identifiable";

export const BasicEsAggregate = <
  const Name extends string,
  const Config extends {
    events: Constructor<IEsEvent>[];
  },
>(
  name: Name,
  config: Config,
) => {
  const base = Derive(
    Identifiable,
    Named(name),
    EventSourced(config.events as Config["events"]),
  );
  abstract class $EsAggregate extends base {}

  return $EsAggregate;
};

export const SnapshottableEsAggregate = <
  const Name extends string,
  const Config extends {
    events: Constructor<IEsEvent>[];
    state: DictShorthand;
  },
>(
  name: Name,
  config: Config,
) => {
  return Shape(
    config.state as Config["state"],
    Derive(
      Identifiable,
      Named(name),
      EventSourced(config.events as Config["events"]),
    ),
  );
};

export const EsAggregate = <
  const Name extends string,
  const Config extends {
    events: Constructor<IEsEvent>[];
    state?: DictShorthand;
  },
>(
  name: Name,
  config: Config,
): Config extends {
  events: Constructor<IEsEvent>[];
  state: DictShorthand;
}
  ? ReturnType<typeof SnapshottableEsAggregate<Name, Config>>
  : ReturnType<typeof BasicEsAggregate<Name, Config>> => {
  if (config.state) {
    return (SnapshottableEsAggregate as any)(name, config);
  }

  return (BasicEsAggregate as any)(name, config);
};
