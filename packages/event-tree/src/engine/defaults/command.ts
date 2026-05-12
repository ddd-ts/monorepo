import { engine } from "../engine";

const COMMAND_BASES = new Set(["$Command", "Command"]);

engine.on((node, parent, ctx, file) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (sup?.type !== "Identifier") return;
  if (!COMMAND_BASES.has(sup.name)) return;

  engine.saveNode({
    type: "command",
    name: node.id.name,
    meta: { base: sup.name },
    source: { file, start: node.start },
  });
});
