import { useMemo, useState, useCallback } from "react"
import { NODE_KINDS, type NodeKind } from "@/domain/node"
import { matchesFilter, type NodeFilter } from "@/domain/filter"
import { nodeId, type GraphIndex, type NodeId } from "@/domain/graph"

export interface FiltersApi {
  filter: NodeFilter
  visibleNodes: GraphIndex["graph"]["nodes"]
  setSearch: (value: string) => void
  toggleKind: (kind: NodeKind) => void
  reset: () => void
}

const ALL_KINDS = new Set<NodeKind>(NODE_KINDS)

export function useFilters(index: GraphIndex): FiltersApi {
  const [search, setSearch] = useState("")
  const [kinds, setKinds] = useState<ReadonlySet<NodeKind>>(ALL_KINDS)

  const filter = useMemo<NodeFilter>(() => ({ search, kinds }), [search, kinds])

  const visibleNodes = useMemo(() => {
    const passingKind = index.graph.nodes.filter((n) => filter.kinds.has(n.type))
    if (!filter.search.trim()) return passingKind
    const directMatches = passingKind.filter((n) => matchesFilter(n, filter))
    if (directMatches.length === 0) return []
    const expanded = expandConnected(index, directMatches)
    return passingKind.filter((n) => expanded.has(nodeId(n.type, n.name)))
  }, [index, filter])

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

function expandConnected(
  index: GraphIndex,
  matches: GraphIndex["graph"]["nodes"]
): Set<string> {
  const visible = new Set<string>()
  const seeds: string[] = []
  for (const n of matches) {
    const id = nodeId(n.type, n.name) as string
    if (!visible.has(id)) {
      visible.add(id)
      seeds.push(id)
    }
  }
  const bfs = (start: string[], edgeMap: GraphIndex["outgoing"], side: "to" | "from") => {
    const queue = [...start]
    while (queue.length) {
      const id = queue.shift()!
      for (const edge of edgeMap.get(id as NodeId) ?? []) {
        const peer = edge[side]
        const peerId = nodeId(peer.type, peer.name) as string
        if (!visible.has(peerId)) {
          visible.add(peerId)
          queue.push(peerId)
        }
      }
    }
  }
  bfs(seeds, index.outgoing, "to")
  bfs(seeds, index.incoming, "from")
  return visible
}
