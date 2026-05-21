import { edgeKind, type Edge, type EdgeKind } from "./edge"
import type { Graph } from "./graph"
import type { Node, NodeKind } from "./node"

const NODE_LABEL: Record<NodeKind, string> = {
  event: "Event",
  command: "Command",
  saga: "Saga",
  aggregate: "Aggregate",
  projection: "Projection",
}

const REL_TYPE: Record<EdgeKind, string> = {
  reacts: "TRIGGERS",
  sends: "SENDS",
  emits: "EMITS",
  "handler-emits": "EMITS",
}

export function exportGraphToCypher(graph: Graph): string {
  if (graph.nodes.length === 0) return "// No nodes to export\n"

  const varByKey = new Map<string, string>()
  graph.nodes.forEach((node, i) => {
    varByKey.set(`${node.type}:${node.name}`, `n${i}`)
  })

  const lines: string[] = []
  lines.push("CREATE")

  const parts: string[] = []
  for (const node of graph.nodes) {
    const variable = varByKey.get(`${node.type}:${node.name}`)!
    parts.push(
      `  (${variable}:${NODE_LABEL[node.type]} {name: ${quote(node.name)}})`
    )
  }
  for (const edge of graph.edges) {
    const from = varByKey.get(`${edge.from.type}:${edge.from.name}`)
    const to = varByKey.get(`${edge.to.type}:${edge.to.name}`)
    if (!from || !to) continue
    parts.push(`  (${from})-[:${REL_TYPE[edgeKind(edge)]}]->(${to})`)
  }

  lines.push(parts.join(",\n") + ";")
  return lines.join("\n") + "\n"
}

export function subgraphFromVisible(
  graph: Graph,
  visibleNodes: Node[]
): Graph {
  const visibleIds = new Set(visibleNodes.map((n) => `${n.type}:${n.name}`))
  return {
    nodes: graph.nodes.filter((n) => visibleIds.has(`${n.type}:${n.name}`)),
    edges: graph.edges.filter(
      (e: Edge) =>
        visibleIds.has(`${e.from.type}:${e.from.name}`) &&
        visibleIds.has(`${e.to.type}:${e.to.name}`)
    ),
  }
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}
