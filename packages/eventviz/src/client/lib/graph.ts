import type { Graph, GraphEdge, GraphNode } from "../../shared/types.js";

export interface GraphIndex {
  nodes: GraphNode[];
  edges: GraphEdge[];
  byId: Record<string, GraphNode>;
  outgoing: Record<string, GraphEdge[]>;
  incoming: Record<string, GraphEdge[]>;
}

export function indexGraph(graph: Graph): GraphIndex {
  const byId: Record<string, GraphNode> = {};
  const outgoing: Record<string, GraphEdge[]> = {};
  const incoming: Record<string, GraphEdge[]> = {};
  for (const n of graph.nodes) {
    byId[n.id] = n;
    outgoing[n.id] = [];
    incoming[n.id] = [];
  }
  for (const e of graph.edges) {
    if (outgoing[e.from]) outgoing[e.from].push(e);
    if (incoming[e.to]) incoming[e.to].push(e);
  }
  return { nodes: graph.nodes, edges: graph.edges, byId, outgoing, incoming };
}

export function chainFrom(
  index: GraphIndex,
  seedId: string,
  direction: "forward" | "backward" | "both" = "both",
  maxDepth = 12,
): { nodes: Set<string>; edges: Set<string> } {
  const nodes = new Set<string>([seedId]);
  const edges = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: seedId, depth: 0 }];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.depth >= maxDepth) continue;
    if (direction === "forward" || direction === "both") {
      for (const e of index.outgoing[cur.id] || []) {
        edges.add(`${e.from}→${e.to}`);
        if (!nodes.has(e.to)) {
          nodes.add(e.to);
          queue.push({ id: e.to, depth: cur.depth + 1 });
        }
      }
    }
    if (direction === "backward" || direction === "both") {
      for (const e of index.incoming[cur.id] || []) {
        edges.add(`${e.from}→${e.to}`);
        if (!nodes.has(e.from)) {
          nodes.add(e.from);
          queue.push({ id: e.from, depth: cur.depth + 1 });
        }
      }
    }
  }
  return { nodes, edges };
}

export function collectDescendants(
  index: GraphIndex,
  id: string,
  direction: "forward" | "reversed",
  pathVisited: Set<string>,
): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  const seen = new Set(pathVisited);
  seen.add(id);
  while (stack.length) {
    const cur = stack.pop()!;
    const edges =
      direction === "forward"
        ? index.outgoing[cur] || []
        : index.incoming[cur] || [];
    for (const e of edges) {
      const next = direction === "forward" ? e.to : e.from;
      if (seen.has(next)) continue;
      seen.add(next);
      result.add(next);
      stack.push(next);
    }
  }
  return result;
}

export function verbFor(
  direction: "forward" | "reversed",
  edgeKind: GraphEdge["kind"],
): string {
  if (direction === "forward") {
    if (edgeKind === "emits") return "emits";
    if (edgeKind === "sends") return "sends";
    if (edgeKind === "reacts") return "triggers";
  } else {
    if (edgeKind === "emits") return "emitted by";
    if (edgeKind === "sends") return "sent by";
    if (edgeKind === "reacts") return "triggered by";
  }
  return edgeKind;
}
