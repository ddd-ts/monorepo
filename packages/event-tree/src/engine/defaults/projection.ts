import { engine } from "../engine";
import {
  classMethods,
  memberPath,
  methodName,
  reactorEvents,
  readStringLiteral,
} from "./_utils";

const REACTOR_DECORATORS = new Set(["Projection.on", "on", "On"]);
const PROJECTION_CALLEES = new Set(["Projection", "Projection.from"]);

engine.on((node, parent, ctx, file) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (!sup) return;

  let alias: string | null = null;

  if (sup.type === "Identifier") {
    if (sup.name !== "Projection") return;
  } else if (sup.type === "CallExpression") {
    const callee = memberPath(sup.callee);
    if (!callee || !PROJECTION_CALLEES.has(callee)) return;
    alias = readStringLiteral(sup.arguments?.[0]);
  } else {
    return;
  }

  const className = node.id.name;
  engine.saveNode({
    type: "projection",
    name: className,
    meta: { alias: alias ?? className },
    source: { file, start: node.start },
  });

  for (const method of classMethods(node)) {
    const name = methodName(method);
    if (!name) continue;
    const events = reactorEvents(method.decorators, REACTOR_DECORATORS);
    for (const event of events) {
      engine.saveEdge({
        from: { type: "event", name: event },
        to: { type: "projection", name: className, method: name },
        source: { file, start: method.start },
      });
    }
  }
});
