import { engine } from "../engine";
import { identifierName, superGenericIdentifier, walkSubtree } from "./_utils";

engine.on((node, parent, ctx, emit) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (sup?.type !== "Identifier" || sup.name !== "CommandHandler") return;

  const command = superGenericIdentifier(node);
  if (!command) return;

  const className = node.id.name;
  emit("command-handler", { className, command, start: node.start });

  const seen = new Set<string>();
  walkSubtree(node.body, (n) => {
    if (n.type !== "NewExpression") return;
    const event = identifierName(n.callee);
    if (!event || seen.has(event)) return;
    seen.add(event);
    emit("command-handler-emits", { className, command, event, start: n.start });
  });
});
