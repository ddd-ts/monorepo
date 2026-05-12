import { engine } from "../engine";
import {
  classMethods,
  methodEffects,
  methodName,
  reactorEvents,
} from "./_utils";

const REACTOR_DECORATORS = new Set(["EsAggregate.on", "on", "On"]);

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (sup?.type !== "Identifier" || sup.name !== "EsAggregate") return;

  const className = node.id.name;
  emit("aggregate", { className, start: node.start });

  for (const method of classMethods(node)) {
    const name = methodName(method);
    if (!name) continue;

    const events = reactorEvents(method.decorators, REACTOR_DECORATORS);
    if (!events.length) continue;

    for (const event of events) {
      emit("aggregate-reacts", { className, method: name, event, start: method.start });
    }

    const effects = methodEffects(method);
    for (const command of effects.sends) {
      emit("aggregate-sends", { className, method: name, command, start: method.start });
    }
    for (const event of effects.emits) {
      emit("aggregate-emits", { className, method: name, event, start: method.start });
    }
  }
});
