import type { Engine } from "../engine";
import {
  constructedName,
  identifierName,
  superGenericIdentifier,
  walkSubtree,
} from "./_utils";

export function applyCommandHandlerDefaults(engine: Engine) {
  engine.on((node, parent, ctx, file) => {
    if (node.type !== "ClassDeclaration") return;
    if (!node.id) return;

    const sup = node.superClass;
    if (sup?.type !== "Identifier" || sup.name !== "CommandHandler") return;

    const command = superGenericIdentifier(node);
    if (!command) return;

    const seen = new Set<string>();
    const invoked = new Set<string>();
    walkSubtree(node.body, (n) => {
      // Direct construction in the handler body: `new X()`, `X.new(...)` or
      // `X.parse(...)`. `to` is assumed to be an event but the real kind is
      // reconciled against the discovered commands/events once every file has
      // been walked (correcting dispatched commands, dropping non-domain
      // instantiations like errors or `Date`).
      const created = constructedName(n);
      if (created) {
        if (!seen.has(created)) {
          seen.add(created);
          engine.saveEdge({
            from: { type: "command", name: command },
            to: { type: "event", name: created },
            source: { file, start: n.start },
          });
        }
        return;
      }

      // Behaviour invoked on a loaded object: `aggregate.method(...)`. Most
      // handlers emit indirectly, by calling an aggregate/entity method that
      // applies events. The receiver is a bare identifier (a loaded aggregate),
      // which skips infrastructure calls like `this.store.save(...)`. The
      // method's effects are attributed to this command in resolveInvocations().
      if (
        n.type === "CallExpression" &&
        n.callee.type === "MemberExpression" &&
        n.callee.object.type === "Identifier"
      ) {
        const method = identifierName(n.callee.property);
        if (method && !invoked.has(method)) {
          invoked.add(method);
          engine.saveInvocation({
            from: { type: "command", name: command },
            method,
            source: { file, start: n.start },
          });
        }
      }
    });
  });
}
