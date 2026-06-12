import type {
  Class,
  Decorator,
  MethodDefinition,
  Node,
} from "oxc-parser";

export function identifierName(node: Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "PrivateIdentifier") return node.name;
  if (node.type === "MemberExpression") return identifierName(node.property);
  return null;
}

export function memberPath(node: Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type !== "MemberExpression") return null;
  const left = memberPath(node.object);
  const right = identifierName(node.property);
  if (left && right) return `${left}.${right}`;
  return right ?? left;
}

function isNode(value: unknown): value is Node {
  if (!value || typeof value !== "object") return false;
  return typeof (value as { type?: unknown }).type === "string";
}

export function walkSubtree(node: Node | null | undefined, visit: (n: Node) => void) {
  if (!node) return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range" || key === "parent") continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const c of child) if (isNode(c)) walkSubtree(c, visit);
    } else if (isNode(child)) {
      walkSubtree(child, visit);
    }
  }
}

export function readStringLiteral(node: Node | null | undefined) {
  if (!node) return null;
  if (node.type !== "Literal") return null;
  if (typeof node.value !== "string") return null;
  return node.value;
}

export function superGenericIdentifier(node: Class) {
  const first = node.superTypeArguments?.params[0];
  if (!first || first.type !== "TSTypeReference") return null;
  if (first.typeName.type !== "Identifier") return null;
  return first.typeName.name;
}

export function reactorEvents(
  decorators: Decorator[] | undefined,
  allowedCallees: Set<string>,
) {
  if (!decorators) return [];
  const events: string[] = [];
  for (const d of decorators) {
    if (d.expression.type !== "CallExpression") continue;

    const callee = memberPath(d.expression.callee);
    if (!callee || !allowedCallees.has(callee)) continue;

    const a0 = d.expression.arguments[0];
    if (a0?.type === "Identifier") events.push(a0.name);
  }
  return events;
}

const SEND_MEMBERS = new Set(["execute", "dispatch", "send"]);
const EMIT_MEMBERS = new Set(["publish", "emit", "apply"]);

/**
 * Resolves the constructed type name from the ddd-ts construction idioms:
 * `new X(...)`, `X.new(...)` and `X.parse(...)`. Events and commands are most
 * often created through the static `.new()`/`.parse()` factories rather than
 * the `new` operator, so both must be recognised.
 */
export function constructedName(node: Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === "NewExpression") return identifierName(node.callee);
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
    const factory = identifierName(node.callee.property);
    if (factory === "new" || factory === "parse") {
      return identifierName(node.callee.object);
    }
  }
  return null;
}

export function methodEffects(method: MethodDefinition) {
  const sends = new Set<string>();
  const emits = new Set<string>();
  const consumed = new WeakSet<object>();

  walkSubtree(method.value.body, (n) => {
    if (n.type !== "CallExpression") return;
    if (n.callee.type !== "MemberExpression") return;
    const member = identifierName(n.callee.property);
    if (!member) return;

    const isSend = SEND_MEMBERS.has(member);
    const isEmit = EMIT_MEMBERS.has(member);
    if (!isSend && !isEmit) return;

    const a0 = n.arguments[0];
    const name =
      constructedName(a0) ?? (a0?.type === "Identifier" ? a0.name : null);
    if (!name) return;

    (isSend ? sends : emits).add(name);
    if (a0 && (a0.type === "NewExpression" || a0.type === "CallExpression")) {
      consumed.add(a0);
    }
  });

  walkSubtree(method.value.body, (n) => {
    if (consumed.has(n as object)) return;
    const name = constructedName(n);
    if (name) emits.add(name);
  });

  return { sends: [...sends], emits: [...emits] };
}

/**
 * Events applied within a method via the aggregate idiom `this.apply(Event.new(...))`
 * (or `this.apply(new Event(...))`). Unlike `methodEffects`, this is scoped to
 * `this.apply(...)` only, so it captures event-application methods (the
 * behaviours a command handler delegates to) without sweeping up command
 * dispatching or unrelated constructions.
 */
export function appliedEvents(method: MethodDefinition): string[] {
  const events = new Set<string>();
  walkSubtree(method.value.body, (n) => {
    if (n.type !== "CallExpression") return;
    if (n.callee.type !== "MemberExpression") return;
    if (n.callee.object.type !== "ThisExpression") return;
    if (identifierName(n.callee.property) !== "apply") return;
    const name = constructedName(n.arguments[0]);
    if (name) events.add(name);
  });
  return [...events];
}

export function classMethods(node: Class) {
  const out: MethodDefinition[] = [];
  for (const member of node.body.body) {
    if (member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition") {
      out.push(member);
    }
  }
  return out;
}

export function methodName(method: MethodDefinition) {
  return identifierName(method.key);
}
