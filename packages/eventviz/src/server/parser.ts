import { parseSync } from "oxc-parser";
import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type {
  EdgeKind,
  Graph,
  GraphEdge,
  GraphNode,
  NodeKind,
} from "../shared/types.js";
import { appendFileSync } from "node:fs";

interface ScannedClass {
  className: string;
  baseName: string | null;
  baseCallee: string | null;
  baseStringArg: string | null;
  baseGenericIdentifier: string | null;
  baseArrayIdentifiers: string[];
  decoratorsOnClass: DecoratorCall[];
  methods: ScannedMethod[];
  newCalls: string[];
  callExprs: CallExpr[];
  file: string;
  line: number;
}

interface ScannedMethod {
  name: string;
  paramTypeIdentifiers: string[];
  decorators: DecoratorCall[];
  newCalls: string[];
  callExprs: CallExpr[];
  line: number;
}

interface DecoratorCall {
  callee: string;
  arg0Identifier: string | null;
  arg0String: string | null;
  arg1ArrayIdentifiers: string[];
}

interface CallExpr {
  receiver: string | null;
  member: string | null;
  callee: string;
  arg0NewIdentifier: string | null;
}

interface FileScan {
  path: string;
  classes: ScannedClass[];
  topLevelNewCalls: string[];
}

const NODE_KIND_BY_BASE: Record<string, NodeKind> = {
  EsEvent: "event",
  Event: "event",
  Command: "command",
  $Command: "command",
  Saga: "saga",
  CommandHandler: "command-handler" as NodeKind,
  Projection: "projection",
};

export interface ParserOptions {
  root: string;
  files: string[];
}

export interface ParseResult {
  graph: Graph;
  errors: { file: string; message: string }[];
}

export async function parseProject(opts: ParserOptions): Promise<ParseResult> {
  const errors: { file: string; message: string }[] = [];
  const scans: FileScan[] = [];

  for (const file of opts.files) {
    try {
      const source = await readFile(file, "utf8");
      scans.push(scanFile(file, source));
    } catch (err) {
      errors.push({
        file,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const graph = buildGraph(opts.root, scans);
  return { graph, errors };
}

function scanFile(file: string, source: string): FileScan {
  const result: FileScan = { path: file, classes: [], topLevelNewCalls: [] };
  let program: any;
  try {
    program = parseSync(file, source).program;
  } catch {
    return result;
  }
  if (!program?.body) return result;

  const lineIndex = buildLineIndex(source);
  for (const stmt of program.body) {
    visitTopLevel(stmt, result, lineIndex);
  }
  return result;
}

function buildLineIndex(source: string): (offset: number) => number {
  // Precompute newline offsets so we can resolve any offset → 1-indexed line.
  const newlines: number[] = [];
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) newlines.push(i);
  }
  return (offset: number) => {
    if (offset == null) return 1;
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (newlines[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
}

function visitTopLevel(
  node: any,
  scan: FileScan,
  lineOf: (offset: number) => number,
) {
  if (!node) return;
  if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
    if (node.declaration) visitTopLevel(node.declaration, scan, lineOf);
    return;
  }
  if (node.type === "ClassDeclaration") {
    scan.classes.push(scanClass(node, scan.path, lineOf));
    return;
  }
}

function scanClass(
  node: any,
  file: string,
  lineOf: (offset: number) => number,
): ScannedClass {
  const cls: ScannedClass = {
    className: node.id?.name ?? "<anonymous>",
    baseName: null,
    baseCallee: null,
    baseStringArg: null,
    baseGenericIdentifier: null,
    baseArrayIdentifiers: [],
    decoratorsOnClass: extractDecorators(node.decorators),
    methods: [],
    newCalls: [],
    callExprs: [],
    file,
    line: lineOf(node.start ?? node.id?.start ?? 0),
  };

  const sup = node.superClass;
  if (sup) {
    if (sup.type === "Identifier") {
      cls.baseName = sup.name;
    } else if (sup.type === "CallExpression") {
      cls.baseName = identifierName(sup.callee);
      cls.baseCallee = memberPath(sup.callee);
      const args = sup.arguments ?? [];
      if (args[0]?.type === "Literal" && typeof args[0].value === "string") {
        cls.baseStringArg = args[0].value;
      } else if (args[0]?.type === "Identifier") {
        cls.baseStringArg = args[0].name;
      }
      // Detect a list of event identifiers passed as 2nd arg, e.g. Projection("Name", [E1, E2])
      if (args[1]?.type === "ArrayExpression") {
        for (const el of args[1].elements ?? []) {
          if (el?.type === "Identifier") cls.baseArrayIdentifiers.push(el.name);
        }
      }
    } else if (sup.type === "TSAsExpression") {
      // Bypass `as` casts
      const inner = sup.expression;
      if (inner?.type === "Identifier") cls.baseName = inner.name;
    }
  }
  // TS generic super: class X extends CommandHandler<MyCommand>
  const supTypeArgs =
    node.superTypeArguments?.params ??
    node.superTypeParameters?.params ??
    null;
  if (supTypeArgs?.[0]) {
    const t = supTypeArgs[0];
    if (t.type === "TSTypeReference" && t.typeName?.type === "Identifier") {
      cls.baseGenericIdentifier = t.typeName.name;
    }
  }

  for (const member of node.body?.body ?? []) {
    if (
      member.type === "MethodDefinition" ||
      member.type === "TSAbstractMethodDefinition"
    ) {
      cls.methods.push(scanMethod(member, lineOf));
    }
  }

  // Collect any `new XEvent(...)` / call expressions anywhere in the class body
  walk(node.body, (n) => {
    if (n.type === "NewExpression") {
      const id = identifierName(n.callee);
      if (id) cls.newCalls.push(id);
    }
    if (n.type === "CallExpression") {
      cls.callExprs.push(extractCallExpr(n));
    }
  });

  return cls;
}

function scanMethod(
  method: any,
  lineOf: (offset: number) => number,
): ScannedMethod {
  const m: ScannedMethod = {
    name: identifierName(method.key) ?? "<anonymous>",
    paramTypeIdentifiers: [],
    decorators: extractDecorators(method.decorators),
    newCalls: [],
    callExprs: [],
    line: lineOf(method.start ?? 0),
  };

  for (const param of method.value?.params ?? []) {
    const ann = param.typeAnnotation?.typeAnnotation;
    if (!ann) continue;
    collectTypeIdentifiers(ann, m.paramTypeIdentifiers);
  }

  walk(method.value?.body, (n) => {
    if (n.type === "NewExpression") {
      const id = identifierName(n.callee);
      if (id) m.newCalls.push(id);
    }
    if (n.type === "CallExpression") {
      m.callExprs.push(extractCallExpr(n));
    }
  });
  return m;
}

function collectTypeIdentifiers(node: any, out: string[]) {
  if (!node) return;
  if (node.type === "TSTypeReference" && node.typeName?.type === "Identifier") {
    out.push(node.typeName.name);
    for (const a of node.typeArguments?.params ?? node.typeParameters?.params ?? []) {
      collectTypeIdentifiers(a, out);
    }
  } else if (node.type === "TSUnionType") {
    for (const t of node.types ?? []) collectTypeIdentifiers(t, out);
  } else if (node.type === "TSIntersectionType") {
    for (const t of node.types ?? []) collectTypeIdentifiers(t, out);
  }
}

function extractDecorators(decs: any[] | undefined): DecoratorCall[] {
  const out: DecoratorCall[] = [];
  if (!decs) return out;
  for (const d of decs) {
    const expr = d.expression;
    if (!expr) continue;
    let callee = "";
    let arg0Identifier: string | null = null;
    let arg0String: string | null = null;
    const arg1ArrayIdentifiers: string[] = [];
    if (expr.type === "CallExpression") {
      callee = memberPath(expr.callee) ?? "";
      const arg0 = expr.arguments?.[0];
      if (arg0?.type === "Identifier") arg0Identifier = arg0.name;
      else if (arg0?.type === "Literal" && typeof arg0.value === "string") arg0String = arg0.value;
      const arg1 = expr.arguments?.[1];
      if (arg1?.type === "ArrayExpression") {
        for (const el of arg1.elements ?? []) {
          if (el?.type === "Identifier") arg1ArrayIdentifiers.push(el.name);
        }
      }
    } else {
      callee = memberPath(expr) ?? "";
    }
    out.push({ callee, arg0Identifier, arg0String, arg1ArrayIdentifiers });
  }
  return out;
}

function extractCallExpr(node: any): CallExpr {
  const callee = node.callee;
  let receiver: string | null = null;
  let member: string | null = null;
  let calleeName = "";
  if (callee?.type === "MemberExpression") {
    if (callee.object?.type === "Identifier") receiver = callee.object.name;
    else if (callee.object?.type === "ThisExpression") receiver = "this";
    member = identifierName(callee.property);
    calleeName = `${receiver ?? ""}.${member ?? ""}`;
  } else if (callee?.type === "Identifier") {
    calleeName = callee.name;
  } else {
    calleeName = memberPath(callee) ?? "";
  }
  let arg0NewIdentifier: string | null = null;
  const a0 = node.arguments?.[0];
  if (a0?.type === "NewExpression") {
    arg0NewIdentifier = identifierName(a0.callee);
  } else if (a0?.type === "Identifier") {
    arg0NewIdentifier = a0.name;
  }
  return { receiver, member, callee: calleeName, arg0NewIdentifier };
}

function identifierName(node: any): string | null {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return identifierName(node.property);
  if (node.type === "PrivateIdentifier") return node.name;
  return null;
}

function memberPath(node: any): string | null {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    const left = memberPath(node.object);
    const right = identifierName(node.property);
    return left && right ? `${left}.${right}` : right ?? left;
  }
  return null;
}

function walk(node: any, visit: (n: any) => void) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range" || key === "parent") continue;
    const child = (node as any)[key];
    if (Array.isArray(child)) {
      for (const c of child) walk(c, visit);
    } else if (child && typeof child === "object" && typeof child.type === "string") {
      walk(child, visit);
    }
  }
}

// ── Build the graph from scanned files ──────────────────────────────────

function buildGraph(root: string, scans: FileScan[]): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const byName = new Map<string, GraphNode>();
  // Map of class names that are command-handlers → their command class name
  const handlerToCommand = new Map<string, string>();
  // Map of class names that are sagas/projections → their node
  const reactorsByClassName = new Map<string, GraphNode>();

  // Pass 1 — create nodes from class declarations
  for (const scan of scans) {
    const rel = relative(root, scan.path) || scan.path;
    for (const cls of scan.classes) {
      const node = classifyAsNode(cls, rel);
      appendFileSync("scans-debug.json", JSON.stringify({ class: cls.className, file: rel, node: node?.id }, null, 2));
      if (!node) continue;
      // Avoid duplicates by name + kind
      const key = `${node.kind}:${node.name}`;
      if (byName.has(key)) continue;
      byName.set(key, node);
      byName.set(node.name, node); // by name only for symbol resolution
      nodes.push(node);
      if (node.name === "Billing") console.log({ cls, node }); // DEBUG
      if (cls.baseName === "CommandHandler" && cls.baseGenericIdentifier) {
        handlerToCommand.set(cls.className, cls.baseGenericIdentifier);
      }
      if (
        cls.baseName === "Saga" ||
        cls.baseName === "Projection" ||
        cls.baseCallee === "Projection.from" ||
        cls.baseName === "EsAggregate"
      ) {
        reactorsByClassName.set(cls.className, node);
      }
    }
    for (const cls of scan.classes) {
      for (const m of cls.methods) {
        const node = classifyAsNode(m, rel, byName.get(`${cls.baseName === "Saga" || cls.baseName === "Projection" || cls.baseName === "EsAggregate" ? cls.className : ""}`));
        if (!node) continue;
        const key = `${cls.baseName}.${node.kind}:${node.name}`;
        if (byName.has(key)) continue;
        byName.set(key, node);
        byName.set(node.name, node);
        nodes.push(node);
      }
    }
  }

  // Pass 1.5 — also synthesize policy nodes from `*.policy.ts` files
  for (const scan of scans) {
    if (!scan.path.endsWith(".policy.ts")) continue;
    const rel = relative(root, scan.path) || scan.path;
    const baseName = pickPolicyName(scan.path);
    if (!baseName) continue;
    const id = makeNodeId("policy", baseName);
    if (byName.has(`policy:${baseName}`)) continue;
    const node: GraphNode = {
      id,
      kind: "policy",
      name: baseName,
      file: rel,
      line: 1,
    };
    byName.set(`policy:${baseName}`, node);
    byName.set(baseName, node);
    nodes.push(node);
  }

  // Pass 2 — extract edges
  for (const scan of scans) {
    for (const cls of scan.classes) {
      const selfNode = byName.get(cls.className);

      // CommandHandler → emits any `new XEvent(...)` found in the class
      if (cls.baseName === "CommandHandler" && cls.baseGenericIdentifier) {
        const cmdNode = byName.get(cls.baseGenericIdentifier);
        if (cmdNode) {
          const seen = new Set<string>();
          for (const id of cls.newCalls) {
            const t = byName.get(id);
            if (!t || t.kind !== "event") continue;
            const key = `${cmdNode.id}|${t.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ from: cmdNode.id, to: t.id, kind: "emits" });
          }
        }
      }

      // Saga: methods reacting to events + sending commands + emitting events
      if (cls.baseName === "Saga" && selfNode) {
        const clsNode = selfNode;
        for (const m of cls.methods) {
          const selfNode = byName.get(`${clsNode.name}.${m.name}`);
          if (!selfNode) continue;
          const reactedTo = new Set<string>();
          for (const dec of m.decorators) {
            if (
              dec.callee === "Saga.on" ||
              dec.callee === "on" ||
              dec.callee === "On"
            ) {
              if (dec.arg0Identifier) reactedTo.add(dec.arg0Identifier);
            }
          }
          for (const id of reactedTo) {
            const ev = byName.get(id);
            if (!ev || ev.kind !== "event") continue;
            edges.push({ from: ev.id, to: selfNode.id, kind: "reacts" });
          }
          // Sends commands and emits events from method bodies
          const sentCmds = new Set<string>();
          const emittedEvts = new Set<string>();
          for (const c of m.callExprs) {
            if (
              c.member === "execute" ||
              c.member === "dispatch" ||
              c.member === "send"
            ) {
              if (c.arg0NewIdentifier) sentCmds.add(c.arg0NewIdentifier);
            }
            if (c.member === "publish" || c.member === "emit") {
              if (c.arg0NewIdentifier) emittedEvts.add(c.arg0NewIdentifier);
            }
          }
          for (const id of m.newCalls) {
            const t = byName.get(id);
            if (t?.kind === "event") emittedEvts.add(id);
          }
          for (const id of sentCmds) {
            const t = byName.get(id);
            if (t?.kind === "command") {
              edges.push({ from: selfNode.id, to: t.id, kind: "sends" });
            }
          }
          for (const id of emittedEvts) {
            const t = byName.get(id);
            if (t?.kind === "event") {
              edges.push({ from: selfNode.id, to: t.id, kind: "emits" });
            }
          }
        }
      }

      // Projection: reacts to events declared by decorators or super-call array
      if (
        (cls.baseName === "Projection" || cls.baseCallee === "Projection.from") &&
        selfNode
      ) {
        const reactedTo = new Set<string>();
        for (const id of cls.baseArrayIdentifiers) reactedTo.add(id);
        for (const m of cls.methods) {
          for (const dec of m.decorators) {
            if (
              dec.callee === "On" ||
              dec.callee === "on" ||
              dec.callee === "Projection.on"
            ) {
              if (dec.arg0Identifier) reactedTo.add(dec.arg0Identifier);
            }
          }
          for (const t of m.paramTypeIdentifiers) {
            const ev = byName.get(t);
            if (ev?.kind === "event") reactedTo.add(t);
          }
        }
        for (const id of reactedTo) {
          const ev = byName.get(id);
          if (!ev || ev.kind !== "event") continue;
          edges.push({ from: ev.id, to: selfNode.id, kind: "reacts" });
        }
      }

            // Saga: methods reacting to events + sending commands + emitting events
      if (cls.baseName === "EsAggregate" && selfNode) {
        console.log('getting aggregate', cls.className, selfNode.id);
        const clsNode = selfNode;
        for (const m of cls.methods) {
          const selfNode = byName.get(`${clsNode.name}.${m.name}`);
          console.log(`  getting method`, m.name, selfNode?.id, `(${clsNode.name}.${m.name})`);
          if (!selfNode) continue;
          const reactedTo = new Set<string>();
          for (const dec of m.decorators) {
            if (
              dec.callee === "EsAggregate.on" ||
              dec.callee === "on" ||
              dec.callee === "On"
            ) {
              if (dec.arg0Identifier) reactedTo.add(dec.arg0Identifier);
            }
          }
          for (const id of reactedTo) {
            const ev = byName.get(id);
            if (!ev || ev.kind !== "event") continue;
            edges.push({ from: ev.id, to: selfNode.id, kind: "reacts" });
          }
          // Sends commands and emits events from method bodies
          const sentCmds = new Set<string>();
          const emittedEvts = new Set<string>();
          for (const c of m.callExprs) {
            if (
              c.member === "execute" ||
              c.member === "dispatch" ||
              c.member === "send"
            ) {
              if (c.arg0NewIdentifier) sentCmds.add(c.arg0NewIdentifier);
            }
            if (c.member === "publish" || c.member === "emit") {
              if (c.arg0NewIdentifier) emittedEvts.add(c.arg0NewIdentifier);
            }
          }
          for (const id of m.newCalls) {
            const t = byName.get(id);
            if (t?.kind === "event") emittedEvts.add(id);
          }
          for (const id of sentCmds) {
            const t = byName.get(id);
            if (t?.kind === "command") {
              edges.push({ from: selfNode.id, to: t.id, kind: "sends" });
            }
          }
          for (const id of emittedEvts) {
            const t = byName.get(id);
            if (t?.kind === "event") {
              edges.push({ from: selfNode.id, to: t.id, kind: "emits" });
            }
          }
        }
      }
    }
  }

  // Deduplicate edges
  const edgeSeen = new Set<string>();
  const dedupedEdges: GraphEdge[] = [];
  for (const e of edges) {
    const k = `${e.from}|${e.to}|${e.kind}`;
    if (edgeSeen.has(k)) continue;
    edgeSeen.add(k);
    dedupedEdges.push(e);
  }

  return { nodes, edges: dedupedEdges };
}

function classifyAsNode(obj: ScannedClass | ScannedMethod, file: string, clsParent?: GraphNode): GraphNode | null {
  if ("className" in obj) {
    const cls = obj;

    const base = cls.baseName;
    const name = cls.className;
    let kind: NodeKind | null = null;

    if (base === "EsEvent" || base === "Event") kind = "event";
    else if (base === "$Command" || base === "Command") kind = "command";
    else if (base === "Saga") kind = "saga";
    else if (base === "EsAggregate") kind = "saga";
    else if (base === "Projection" || cls.baseCallee === "Projection.from") {
      kind = "projection";
    } else if (base === "CommandHandler") {
      return null; // handlers create edges, not nodes
    }

    if (!kind) return null;

    // Prefer the runtime-name string if present (e.g. EsEvent("BookingRequested", …))
    const runtimeName = cls.baseStringArg ?? name;
    return {
      id: makeNodeId(kind, runtimeName),
      kind,
      name,
      file,
      line: cls.line,
    };
  } else if (clsParent) {
    const m = obj;
    if (m.decorators.every((d) => !d.callee.toLowerCase().includes("on"))) return null;
    const name = `${clsParent.name}.${m.name}`;
    return {
      id: makeNodeId(clsParent.kind, name),
      kind: clsParent.kind,
      name,
      file,
      line: m.line,
    };
  }

  return null;
}

function makeNodeId(kind: NodeKind, name: string): string {
  const prefix =
    kind === "command"
      ? "cmd"
      : kind === "event"
        ? "evt"
        : kind === "effect"
          ? "eff"
          : kind === "saga"
            ? "saga"
            : kind === "projection"
              ? "proj"
              : "pol";
  return `${prefix}.${slug(name)}`;
}

function slug(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1.$2")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase();
}

function pickPolicyName(path: string): string | null {
  const m = path.match(/([^/\\]+)\.policy\.ts$/);
  if (!m) return null;
  return m[1]
    .split(/[-_.]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join("") + "Policy";
}
