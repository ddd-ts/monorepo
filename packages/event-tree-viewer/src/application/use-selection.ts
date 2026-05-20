import { useCallback, useState } from "react"
import { type NodeId } from "@/domain/graph"

export interface SelectionApi {
  selectedId: NodeId | null
  select: (id: NodeId) => void
  clear: () => void
}

export function useSelection(): SelectionApi {
  const [selectedId, setSelectedId] = useState<NodeId | null>(null)
  const select = useCallback((id: NodeId) => setSelectedId(id), [])
  const clear = useCallback(() => setSelectedId(null), [])
  return { selectedId, select, clear }
}
