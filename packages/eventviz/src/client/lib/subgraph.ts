import type { GraphEdge } from "../../shared/types.js";
import type { GraphIndex } from "./graph.js";

/**
 * Walk the graph from each root in `direction`, applying the
 * mustContain filter (each surviving root's reachable set must contain
 * `mustContain` as either ALL of them or ANY of them).
 *
 * Returns the set of visible node ids and edges. Tree-cycle protection
 * matches LinearChainsView semantics: along any path we never revisit a
 * node, but two roots may share descendants.
 */
export function computeVisibleSubgraph(params: {
  index: GraphIndex;
  roots: string[];
  direction: "forward" | "reversed";
  mustContain: string[];
  mustContainAll: boolean;
}): { nodes: Set<string>; edges: GraphEdge[] } {
  const { index, roots, direction, mustContain, mustContainAll } = params;
  const visibleNodes = new Set<string>();
  const visibleEdges: GraphEdge[] = [];
  const seenEdge = new Set<string>();

  for (const rid of roots) {
    if (!index.byId[rid]) continue;
    if (mustContain.length > 0) {
      const reachable = collectReachable(index, rid, direction);
      const passes = mustContainAll
        ? mustContain.every((mid) => reachable.has(mid))
        : mustContain.some((mid) => reachable.has(mid));
      if (!passes) continue;
    }
    walk(rid, []);
  }
  return { nodes: visibleNodes, edges: visibleEdges };

  function walk(id: string, pathIds: string[]) {
    visibleNodes.add(id);
    const edges =
      direction === "forward"
        ? index.outgoing[id] || []
        : index.incoming[id] || [];
    for (const e of edges) {
      const nextId = direction === "forward" ? e.to : e.from;
      if (pathIds.includes(nextId)) continue; // avoid cycles along a path
      const key = `${e.from}→${e.to}|${e.kind}`;
      if (mustContain.length > 0) {
        const reachable = collectReachable(index, nextId, direction);
        reachable.add(nextId);
        const passes = mustContainAll
          ? mustContain.every((mid) => reachable.has(mid))
          : mustContain.some((mid) => reachable.has(mid));
        if (!passes) continue;
      }
      if (!seenEdge.has(key)) {
        seenEdge.add(key);
        visibleEdges.push(e);
      }
      if (!visibleNodes.has(nextId)) {
        walk(nextId, [...pathIds, id]);
      }
    }
  }
}

function collectReachable(
  index: GraphIndex,
  start: string,
  direction: "forward" | "reversed",
): Set<string> {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    const edges =
      direction === "forward"
        ? index.outgoing[id] || []
        : index.incoming[id] || [];
    for (const e of edges) {
      const next = direction === "forward" ? e.to : e.from;
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}
