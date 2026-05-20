import { useMemo, useState, useCallback } from "react"
import { NODE_KINDS, type NodeKind } from "@/domain/node"
import { matchesFilter, type NodeFilter } from "@/domain/filter"
import { nodeId, type GraphIndex, type NodeId } from "@/domain/graph"
import type { Direction } from "@/domain/direction"

export interface FiltersApi {
  filter: NodeFilter
  visibleNodes: GraphIndex["graph"]["nodes"]
  setSearch: (value: string) => void
  toggleKind: (kind: NodeKind) => void
  reset: () => void
}

const ALL_KINDS = new Set<NodeKind>(NODE_KINDS)

export function useFilters(index: GraphIndex, direction: Direction): FiltersApi {
  const [search, setSearch] = useState("")
  const [kinds, setKinds] = useState<ReadonlySet<NodeKind>>(ALL_KINDS)

  const filter = useMemo<NodeFilter>(() => ({ search, kinds }), [search, kinds])

  const visibleNodes = useMemo(() => {
    const passingKind = index.graph.nodes.filter((n) => filter.kinds.has(n.type))
    if (!filter.search.trim()) return passingKind
    const directMatches = passingKind.filter((n) => matchesFilter(n, filter))
    if (directMatches.length === 0) return []
    const expanded = expandDescendants(index, directMatches, direction)
    return passingKind.filter((n) => expanded.has(nodeId(n.type, n.name)))
  }, [index, filter, direction])

  const toggleKind = useCallback((kind: NodeKind) => {
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSearch("")
    setKinds(ALL_KINDS)
  }, [])

  return { filter, visibleNodes, setSearch, toggleKind, reset }
}

function expandDescendants(
  index: GraphIndex,
  matches: GraphIndex["graph"]["nodes"],
  direction: Direction
): Set<string> {
  const visible = new Set<string>()
  const queue: string[] = []
  for (const n of matches) {
    const id = nodeId(n.type, n.name) as string
    if (!visible.has(id)) {
      visible.add(id)
      queue.push(id)
    }
  }
  while (queue.length) {
    const id = queue.shift()!
    const edges =
      direction === "forward"
        ? (index.outgoing.get(id as NodeId) ?? [])
        : (index.incoming.get(id as NodeId) ?? [])
    for (const edge of edges) {
      const peer = direction === "forward" ? edge.to : edge.from
      const peerId = nodeId(peer.type, peer.name) as string
      if (!visible.has(peerId)) {
        visible.add(peerId)
        queue.push(peerId)
      }
    }
  }
  return visible
}
