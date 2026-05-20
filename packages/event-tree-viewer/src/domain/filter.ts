import type { Node, NodeKind } from "./node"

export interface NodeFilter {
  search: string
  kinds: ReadonlySet<NodeKind>
}

export function matchesFilter(node: Node, filter: NodeFilter): boolean {
  if (!filter.kinds.has(node.type)) return false
  if (!filter.search) return true
  const q = filter.search.toLowerCase()
  if (node.name.toLowerCase().includes(q)) return true
  if (
    "meta" in node &&
    "alias" in node.meta &&
    node.meta.alias.toLowerCase().includes(q)
  ) {
    return true
  }
  return false
}
