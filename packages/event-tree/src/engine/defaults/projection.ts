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

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (!sup) return;

  let runtimeName: string | null = null;

  if (sup.type === "Identifier") {
    if (sup.name !== "Projection") return;
  } else if (sup.type === "CallExpression") {
    const callee = memberPath(sup.callee);
    if (!callee || !PROJECTION_CALLEES.has(callee)) return;
    runtimeName = readStringLiteral(sup.arguments?.[0]);
  } else {
    return;
  }

  const className = node.id.name;
  emit("projection", {
    className,
    runtimeName: runtimeName ?? className,
    start: node.start,
  });

  for (const method of classMethods(node)) {
    const name = methodName(method);
    if (!name) continue;
    const events = reactorEvents(method.decorators, REACTOR_DECORATORS);
    for (const event of events) {
      emit("projection-reacts", { className, method: name, event, start: method.start });
    }
  }
});
