import type { Engine } from "../engine";

const COMMAND_BASES = new Set(["$Command", "Command"]);

export function applyCommandDefaults(engine: Engine) {
  engine.on((node, parent, ctx, file) => {
    if (node.type !== "ClassDeclaration") return;
    if (!node.id) return;

    const sup = node.superClass;
    if (!sup) return;

    let base: string | null = null;
    if (sup.type === "Identifier") {
      if (COMMAND_BASES.has(sup.name)) base = sup.name;
    } else if (sup.type === "CallExpression") {
      if (sup.callee?.type === "Identifier" && COMMAND_BASES.has(sup.callee.name)) {
        base = sup.callee.name;
      }
    }
    if (!base) return;

    engine.saveNode({
      type: "command",
      name: node.id.name,
      meta: { base },
      source: { file, start: node.start },
    });
  });
}
