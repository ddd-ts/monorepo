import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { indexGraph, type GraphIndex } from "@/domain/graph"
import { trpc } from "./trpc-client"

export interface UseGraphResult {
  status: "loading" | "ready" | "error"
  index: GraphIndex
  error: string | null
  refetch: () => void
}

const EMPTY: GraphIndex = indexGraph({ nodes: [], edges: [] })

export function useGraph(): UseGraphResult {
  const { data, error, refetch, isPending } = useQuery({
    queryKey: ["graph"],
    queryFn: () =>
      trpc.graph.get.query() as Promise<{
        nodes: unknown[]
        edges: unknown[]
      }>,
  })

  const index = useMemo(() => {
    if (!data) return EMPTY
    return indexGraph(data as Parameters<typeof indexGraph>[0])
  }, [data])

  return {
    status: error ? "error" : isPending ? "loading" : "ready",
    index,
    error: error ? String(error.message ?? error) : null,
    refetch: () => {
      void refetch()
    },
  }
}
