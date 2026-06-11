import { engine } from "../engine";
import { identifierName, superGenericIdentifier, walkSubtree } from "./_utils";

engine.on((node, parent, ctx, file) => {
  if (node.type !== "ClassDeclaration") return;
  if (!node.id) return;

  const sup = node.superClass;
  if (sup?.type !== "Identifier" || sup.name !== "CommandHandler") return;

  const command = superGenericIdentifier(node);
  if (!command) return;

  const seen = new Set<string>();
  walkSubtree(node.body, (n) => {
    if (n.type !== "NewExpression") return;
    const event = identifierName(n.callee);
    if (!event || seen.has(event)) return;
    seen.add(event);
    // `to` is assumed to be an event here, but the target's real kind is only
    // known once every file has been walked: the engine reconciles it against
    // the discovered commands/events (correcting dispatched commands, dropping
    // non-domain instantiations like errors or `Date`).
    engine.saveEdge({
      from: { type: "command", name: command },
      to: { type: "event", name: event },
      source: { file, start: n.start },
    });
  });
});
