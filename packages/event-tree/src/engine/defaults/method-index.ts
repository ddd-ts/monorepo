import type { Engine } from "../engine";
import { appliedEvents, classMethods, methodName } from "./_utils";

/**
 * Indexes aggregate/entity event-application methods (`this.apply(Event.new(...))`)
 * by method name. The engine later joins these against recorded
 * `receiver.method(...)` calls so a caller (e.g. a command handler) is linked to
 * the events it ultimately produces, even when the emit happens in another
 * class. Scoped to `this.apply(...)` so command-dispatch methods (every
 * handler's `execute`, command buses, …) don't become catch-all matches.
 */
export function applyMethodIndexDefaults(engine: Engine) {
  engine.on((node) => {
    if (node.type !== "ClassDeclaration" || !node.id) return;
    const owner = node.id.name;
    for (const method of classMethods(node)) {
      const name = methodName(method);
      if (!name) continue;
      const events = appliedEvents(method);
      if (events.length) {
        engine.indexBehaviour(name, owner, events);
      }
    }
  });
}
