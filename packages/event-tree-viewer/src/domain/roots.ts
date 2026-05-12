import type { Direction } from "./direction";
import type { GraphIndex, NodeId } from "./graph";
import type { Node } from "./node";
import { nodeId } from "./graph";

export function effectiveRoots(index: GraphIndex, direction: Direction): NodeId[] {
  return index.graph.nodes.filter((n) => isRoot(n, direction)).map((n) => nodeId(n.type, n.name));
}

function isRoot(node: Node, direction: Direction): boolean {
  if (direction === "forward") return node.type === "event";
  return node.type !== "event";
}
