import { useEffect, useMemo, useState } from "react";
import { indexGraph, type GraphIndex } from "@/domain/graph";
import { trpc } from "./trpc-client";

export interface UseGraphResult {
  status: "loading" | "ready" | "error";
  index: GraphIndex;
  error: string | null;
  refetch: () => void;
}

const EMPTY: GraphIndex = indexGraph({ nodes: [], edges: [] });

export function useGraph(): UseGraphResult {
  const [graph, setGraph] = useState<{ nodes: unknown[]; edges: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    trpc.graph.get
      .query()
      .then((g) => {
        if (!cancelled) setGraph(g as { nodes: unknown[]; edges: unknown[] });
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const index = useMemo(() => {
    if (!graph) return EMPTY;
    return indexGraph(graph as Parameters<typeof indexGraph>[0]);
  }, [graph]);

  return {
    status: error ? "error" : graph ? "ready" : "loading",
    index,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
