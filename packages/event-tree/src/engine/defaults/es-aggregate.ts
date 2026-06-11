import type { Engine } from "../engine";
import {
  classMethods,
  methodEffects,
  methodName,
  reactorEvents,
} from "./_utils";

const REACTOR_DECORATORS = new Set(["EsAggregate.on", "on", "On"]);

export function applyEsAggregateDefaults(engine: Engine) {
  engine.on((node, parent, ctx, file) => {
    if (node.type !== "ClassDeclaration") return;
    if (!node.id) return;

    const sup = node.superClass;
    if (!sup) return;
    if (sup.type === "Identifier") {
      if (sup.name !== "EsAggregate") return;
    } else if (sup.type === "CallExpression") {
      if (sup.callee?.type !== "Identifier" || sup.callee.name !== "EsAggregate") return;
    } else {
      return;
    }

    const className = node.id.name;

    for (const method of classMethods(node)) {
      const name = methodName(method);
      if (!name) continue;

      const events = reactorEvents(method.decorators, REACTOR_DECORATORS);
      if (!events.length) continue;

      const handlerName = `${className}.${name}`;
      engine.saveNode({
        type: "aggregate",
        name: handlerName,
        source: { file, start: method.start },
      });

      for (const event of events) {
        engine.saveEdge({
          from: { type: "event", name: event },
          to: { type: "aggregate", name: handlerName },
          source: { file, start: method.start },
        });
      }

      const effects = methodEffects(method);
      for (const command of effects.sends) {
        engine.saveEdge({
          from: { type: "aggregate", name: handlerName },
          to: { type: "command", name: command },
          source: { file, start: method.start },
        });
      }
      for (const event of effects.emits) {
        engine.saveEdge({
          from: { type: "aggregate", name: handlerName },
          to: { type: "event", name: event },
          source: { file, start: method.start },
        });
      }
    }
  });
}
