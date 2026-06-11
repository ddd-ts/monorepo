import type { Engine } from "../engine";

export function applyExampleDefaults(engine: Engine) {
  engine.on((node, parent, ctx, file) => {
    if (node.type !== "ClassDeclaration") return;

    node.superClass
  });
}
