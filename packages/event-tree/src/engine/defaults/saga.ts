import { engine } from "../engine";
import {
  classMethods,
  methodEffects,
  methodName,
  reactorEvents,
} from "./_utils";

const REACTOR_DECORATORS = new Set(["Saga.on", "on", "On"]);

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (sup?.type !== "Identifier" || sup.name !== "Saga") return;

  const className = node.id.name;
  emit("saga", { className, start: node.start });

  for (const method of classMethods(node)) {
    const name = methodName(method);
    if (!name) continue;

    const events = reactorEvents(method.decorators, REACTOR_DECORATORS);
    if (!events.length) continue;

    for (const event of events) {
      emit("saga-reacts", { className, method: name, event, start: method.start });
    }

    const effects = methodEffects(method);
    for (const command of effects.sends) {
      emit("saga-sends", { className, method: name, command, start: method.start });
    }
    for (const event of effects.emits) {
      emit("saga-emits", { className, method: name, event, start: method.start });
    }
  }
});
