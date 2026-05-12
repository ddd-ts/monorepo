import type { Edge } from "./edge";
import { type GraphIndex, nodeId, type NodeId } from "./graph";
import type { Node } from "./node";
import type { Direction } from "./direction";

export interface TraceNode {
  id: NodeId;
  node: Node;
  edge: Edge | null;
  children: TraceNode[];
}

export function traceFrom(
  index: GraphIndex,
  rootId: NodeId,
  direction: Direction = "forward",
  maxDepth = 6,
): TraceNode | null {
  const root = index.nodesById.get(rootId);
  if (!root) return null;
  return build(index, root, null, direction, new Set(), maxDepth);
}

function build(
  index: GraphIndex,
  node: Node,
  edge: Edge | null,
  direction: Direction,
  seen: Set<NodeId>,
  remaining: number,
): TraceNode {
  const id = nodeId(node.type, node.name);
  if (remaining <= 0 || seen.has(id)) {
    return { id, node, edge, children: [] };
  }
  const next = new Set(seen).add(id);
  const edges = stepEdges(index, id, direction);
  const children: TraceNode[] = [];
  for (const e of edges) {
    const peer = peerOf(e, direction);
    const peerId = nodeId(peer.type, peer.name);
    const target = index.nodesById.get(peerId);
    if (!target) continue;
    children.push(build(index, target, e, direction, next, remaining - 1));
  }
  return { id, node, edge, children };
}

function stepEdges(index: GraphIndex, id: NodeId, direction: Direction): Edge[] {
  if (direction === "forward") return index.outgoing.get(id) ?? [];
  return index.incoming.get(id) ?? [];
}

function peerOf(edge: Edge, direction: Direction) {
  return direction === "forward" ? edge.to : edge.from;
}
