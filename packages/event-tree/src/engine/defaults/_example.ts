import { engine } from "../engine";

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;

  node.superClass
})
