import fs from "node:fs";
import { parseAndWalk, type WalkerEnter } from "oxc-walker";
import type { Node } from "../node";
import type { Edge } from "../edge";
import { applyDefaults } from "./defaults";

type AstWalker = (
  ...args: [...Parameters<WalkerEnter>, file: string]
) => ReturnType<WalkerEnter>;

export class Engine {
  private astWalkers: AstWalker[] = [];

  on(walker: AstWalker) {
    this.astWalkers.push(walker);
    return this;
  }

  private fileScanner: (root: string) => Iterable<string> = function* () {
    console.warn(
      `No file scanner configured for event-tree engine. Please call engine.scan() with a file scanner function.`,
    );
  };
  scan(fileScanner: (root: string) => Iterable<string>) {
    this.fileScanner = fileScanner;
    return this;
  }

  private edges: Edge[] = [];
  saveEdge(edge: Edge) {
    this.edges.push(edge);
  }
  getEdges(): readonly Edge[] {
    return this.edges;
  }

  private nodes: Node[] = [];
  saveNode(node: Node) {
    this.nodes.push(node);
  }
  getNodes(): readonly Node[] {
    return this.nodes;
  }

  // Event-application methods indexed by method name, then by the class that
  // declares them. Lets a caller be linked to a method's events without
  // resolving the receiver's static type. Keeping the owning class lets us
  // detect ambiguity: a method name declared in more than one class can't be
  // attributed by name alone. Populated during the walk (see method-index).
  private behaviours = new Map<string, Map<string, Set<string>>>();
  indexBehaviour(method: string, owner: string, events: readonly string[]) {
    let byOwner = this.behaviours.get(method);
    if (!byOwner) {
      byOwner = new Map();
      this.behaviours.set(method, byOwner);
    }
    let entry = byOwner.get(owner);
    if (!entry) {
      entry = new Set();
      byOwner.set(owner, entry);
    }
    for (const e of events) entry.add(e);
  }

  // `receiver.method(...)` calls recorded by walkers (e.g. a command handler
  // invoking an aggregate method). Resolved against `behaviours` after the walk
  // to attribute the callee's effects to the caller.
  private invocations: {
    from: { type: "command"; name: string };
    method: string;
    source: { file: string; start: number };
  }[] = [];
  saveInvocation(invocation: {
    from: { type: "command"; name: string };
    method: string;
    source: { file: string; start: number };
  }) {
    this.invocations.push(invocation);
  }

  /**
   * Expands recorded `receiver.method(...)` calls into edges from the caller to
   * whatever the callee emits/sends. This links a command handler that
   * delegates to an aggregate method (e.g. `message.destroy()` →
   * `this.apply(SomeEvent.new(...))`) to the events it ultimately produces.
   * Matching is by method name only — no receiver type resolution. To stay
   * precise we attribute a method's events only when that name is declared in a
   * single class; a name shared across classes (e.g. `enable`/`disable` on many
   * feature aggregates) is ambiguous and skipped. Edges to unknown targets are
   * dropped later by resolveEdges().
   */
  private resolveInvocations() {
    for (const { from, method, source } of this.invocations) {
      const byOwner = this.behaviours.get(method);
      if (!byOwner || byOwner.size !== 1) continue;
      const [events] = byOwner.values();
      for (const name of events) {
        this.edges.push({ from, to: { type: "event", name }, source });
      }
    }
  }

  /**
   * Edge targets discovered from `new X()` calls are speculative: when a walker
   * records them it only knows the constructor name, not whether `X` is a
   * command, an event, or something unrelated (an error, `Date`, ...). It
   * therefore guesses a kind (e.g. command handlers assume every instantiation
   * is an emitted event). Once every file has been walked we know the full set
   * of commands and events, so we reconcile each command/event-targeted edge
   * against it: keep the guess when it matches a real node, correct the kind
   * when the target turns out to be the other kind (e.g. a command handler that
   * dispatches another command), and drop edges that point at a class which is
   * neither a command nor an event.
   */
  private resolveEdges() {
    const commands = new Set<string>();
    const events = new Set<string>();
    for (const node of this.nodes) {
      if (node.type === "command") commands.add(node.name);
      else if (node.type === "event") events.add(node.name);
    }

    this.edges = this.edges.flatMap((edge) => {
      // Reactor targets (saga/aggregate/projection) come from reliable
      // declarations, not from instantiations — leave them untouched.
      if (edge.to.type !== "command" && edge.to.type !== "event") return [edge];

      const isCommand = commands.has(edge.to.name);
      const isEvent = events.has(edge.to.name);
      if (!isCommand && !isEvent) return [];

      // Keep the assumed kind when a matching node exists, otherwise switch to
      // the kind that actually does.
      const resolved =
        edge.to.type === "command"
          ? isCommand
            ? "command"
            : "event"
          : isEvent
            ? "event"
            : "command";

      if (resolved === edge.to.type) return [edge];
      return [{ ...edge, to: { type: resolved, name: edge.to.name } } as Edge];
    });
  }

  reset() {
    this.edges = [];
    this.nodes = [];
    this.invocations = [];
    this.behaviours = new Map();
  }

  run(root: string = process.cwd()) {
    for (const file of this.fileScanner(root)) {
      const code = fs.readFileSync(file, "utf8");
      const walkers = this.astWalkers;
      parseAndWalk(code, file, {
        enter: function (node, parent, ctx) {
          for (const walker of walkers) {
            try {
              walker.call(this, node, parent, ctx, file);
            } catch (error) {
              console.error(
                `Error occurred while walking node in file ${file}:`,
                error,
              );
            }
          }
        },
      });
    }
    this.resolveInvocations();
    this.resolveEdges();
  }
}

export function createDefaultEngine(): Engine {
  const engine = new Engine();
  applyDefaults(engine);
  return engine;
}

export const engine = createDefaultEngine();
