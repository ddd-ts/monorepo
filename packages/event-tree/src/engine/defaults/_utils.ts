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
const EMIT_MEMBERS = new Set(["publish", "emit"]);

export function methodEffects(method: MethodDefinition) {
  const sends = new Set<string>();
  const emits = new Set<string>();
  walkSubtree(method.value.body, (n) => {
    if (n.type === "NewExpression") {
      const id = identifierName(n.callee);
      if (id) emits.add(id);
      return;
    }

    if (n.type !== "CallExpression") return;

    const a0 = n.arguments[0];
    let arg0New: string | null = null;
    if (a0?.type === "NewExpression") arg0New = identifierName(a0.callee);
    else if (a0?.type === "Identifier") arg0New = a0.name;
    if (!arg0New) return;

    if (n.callee.type !== "MemberExpression") return;
    const member = identifierName(n.callee.property);
    if (!member) return;

    if (SEND_MEMBERS.has(member)) sends.add(arg0New);
    else if (EMIT_MEMBERS.has(member)) emits.add(arg0New);
  });
  return { sends: [...sends], emits: [...emits] };
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
