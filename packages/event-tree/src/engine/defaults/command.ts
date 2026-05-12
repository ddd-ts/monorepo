import { engine } from "../engine";

const COMMAND_BASES = new Set(["$Command", "Command"]);

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (sup?.type !== "Identifier") return;
  if (!COMMAND_BASES.has(sup.name)) return;

  emit("command", {
    className: node.id.name,
    base: sup.name,
    start: node.start,
  });
});
