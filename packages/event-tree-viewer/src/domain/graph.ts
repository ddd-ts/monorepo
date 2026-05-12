import type { Edge } from "./edge";
import type { Node, NodeKind } from "./node";

export type Graph = { nodes: Node[]; edges: Edge[] };

export type NodeId = `${NodeKind}:${string}`;

export function nodeId(kind: NodeKind, name: string): NodeId {
  return `${kind}:${name}`;
}

export interface GraphIndex {
  graph: Graph;
  nodesById: ReadonlyMap<NodeId, Node>;
  outgoing: ReadonlyMap<NodeId, Edge[]>;
  incoming: ReadonlyMap<NodeId, Edge[]>;
}

export function indexGraph(graph: Graph): GraphIndex {
  const nodesById = new Map<NodeId, Node>();
  const outgoing = new Map<NodeId, Edge[]>();
  const incoming = new Map<NodeId, Edge[]>();

  for (const node of graph.nodes) {
    nodesById.set(nodeId(node.type, node.name), node);
  }

  for (const edge of graph.edges) {
    const fromId = nodeId(edge.from.type, edge.from.name);
    const toId = nodeId(edge.to.type, edge.to.name);

    const outList = outgoing.get(fromId) ?? [];
    outList.push(edge);
    outgoing.set(fromId, outList);

    const inList = incoming.get(toId) ?? [];
    inList.push(edge);
    incoming.set(toId, inList);
  }

  return { graph, nodesById, outgoing, incoming };
}
