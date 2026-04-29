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

export function humanCase(name: string): string {
  return name
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function folderOf(file: string): string {
  const parts = file.split(/[\\/]/).filter((s) => s && s !== ".");
  parts.pop();
  return parts.join("/");
}

export interface NodeDomain {
  /** Unique grouping key (folder path). */
  key: string;
  /** Display label, disambiguated when multiple folders share a last segment. */
  label: string;
}

/**
 * Group nodes by domain. A node's domain folder is the deepest folder
 * ancestor whose name is unique in the project — structural names like
 * `applicative`, `domain`, `events`, `commands` appear under multiple
 * parents, so we walk past them up to the first folder name that only
 * exists in one place (typically the bounded-context folder).
 */
export function computeDomains(
  nodes: { id: string; file: string }[],
): Map<string, NodeDomain> {
  const nodeChain = new Map<string, string[]>();
  const allFolders = new Set<string>();
  for (const n of nodes) {
    const folder = folderOf(n.file);
    const chain: string[] = [];
    if (folder) {
      const parts = folder.split("/");
      for (let i = parts.length; i > 0; i--) {
        chain.push(parts.slice(0, i).join("/"));
      }
    }
    nodeChain.set(n.id, chain);
    for (const f of chain) allFolders.add(f);
  }
  const segNameCounts = new Map<string, number>();
  for (const f of allFolders) {
    const seg = f.split("/").filter(Boolean).pop();
    if (!seg) continue;
    segNameCounts.set(seg, (segNameCounts.get(seg) ?? 0) + 1);
  }

  const picks = new Map<string, string>();
  for (const n of nodes) {
    const chain = nodeChain.get(n.id) ?? [];
    let pick = chain[0] ?? "";
    for (const f of chain) {
      const seg = f.split("/").filter(Boolean).pop();
      if (seg && (segNameCounts.get(seg) ?? 0) === 1) {
        pick = f;
        break;
      }
    }
    picks.set(n.id, pick);
  }

  const labels = labelFolders([...new Set(picks.values())]);
  const out = new Map<string, NodeDomain>();
  for (const [id, key] of picks) {
    out.set(id, { key, label: labels.get(key) ?? "·" });
  }
  return out;
}

function labelFolders(paths: string[]): Map<string, string> {
  const segsByPath = new Map<string, string[]>();
  for (const p of paths) {
    segsByPath.set(p, p.split("/").filter(Boolean));
  }
  const result = new Map<string, string>();
  for (const path of paths) {
    const segs = segsByPath.get(path) ?? [];
    if (segs.length === 0) {
      result.set(path, "·");
      continue;
    }
    let pickedSegment = segs[segs.length - 1];
    for (let n = 1; n <= segs.length; n++) {
      const suffix = segs.slice(segs.length - n).join("/");
      let collisions = 0;
      for (const other of paths) {
        const o = segsByPath.get(other) ?? [];
        if (o.length < n) continue;
        if (o.slice(o.length - n).join("/") === suffix) collisions++;
      }
      if (collisions === 1) {
        pickedSegment = segs[segs.length - n];
        break;
      }
    }
    result.set(path, humanCase(pickedSegment) || "·");
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
