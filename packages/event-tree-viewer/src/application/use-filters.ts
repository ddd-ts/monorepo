import { useMemo, useState, useCallback } from "react";
import { NODE_KINDS, type NodeKind } from "@/domain/node";
import { matchesFilter, type NodeFilter } from "@/domain/filter";
import type { GraphIndex } from "@/domain/graph";

export interface FiltersApi {
  filter: NodeFilter;
  visibleNodes: GraphIndex["graph"]["nodes"];
  setSearch: (value: string) => void;
  toggleKind: (kind: NodeKind) => void;
  reset: () => void;
}

const ALL_KINDS = new Set<NodeKind>(NODE_KINDS);

export function useFilters(index: GraphIndex): FiltersApi {
  const [search, setSearch] = useState("");
  const [kinds, setKinds] = useState<ReadonlySet<NodeKind>>(ALL_KINDS);

  const filter = useMemo<NodeFilter>(() => ({ search, kinds }), [search, kinds]);

  const visibleNodes = useMemo(
    () => index.graph.nodes.filter((n) => matchesFilter(n, filter)),
    [index, filter],
  );

  const toggleKind = useCallback((kind: NodeKind) => {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSearch("");
    setKinds(ALL_KINDS);
  }, []);

  return { filter, visibleNodes, setSearch, toggleKind, reset };
}
