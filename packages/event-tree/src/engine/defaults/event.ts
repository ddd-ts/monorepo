import { engine } from "../engine";
import { readStringLiteral } from "./_utils";

const EVENT_BASES = new Set(["EsEvent", "OldEvent", "Event"]);

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (!sup) return;

  if (sup.type === "Identifier") {
    if (!EVENT_BASES.has(sup.name)) return;

    emit("event", {
      className: node.id.name,
      runtimeName: node.id.name,
      base: sup.name,
      start: node.start,
    });
    return;
  }

  if (sup.type !== "CallExpression") return;
  if (sup.callee?.type !== "Identifier") return;
  if (!EVENT_BASES.has(sup.callee.name)) return;

  emit("event", {
    className: node.id.name,
    runtimeName: readStringLiteral(sup.arguments?.[0]) ?? node.id.name,
    base: sup.callee.name,
    start: node.start,
  });
});
