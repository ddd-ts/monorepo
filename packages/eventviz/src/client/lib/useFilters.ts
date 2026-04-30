import { useMemo, useState } from "react";
import { executeCypher } from "./cypher.js";
import type { GraphIndex } from "./graph.js";

export type ViewMode = "tree" | "graph" | "flat";
export type Direction = "forward" | "reversed";

export interface FiltersState {
  view: ViewMode;
  direction: Direction;
  rootIds: string[];
  contains: string[];
  containsAll: boolean;
  cypherQuery: string;
  advancedOpen: boolean;
}

export interface FiltersApi {
  setView: (v: ViewMode) => void;
  setDirection: (d: Direction) => void;
  setRootIds: (ids: string[]) => void;
  setContains: (ids: string[]) => void;
  setContainsAll: (v: boolean) => void;
  setCypherQuery: (q: string) => void;
  setAdvancedOpen: (open: boolean) => void;
}

export interface CypherStatus {
  ok: boolean;
  error?: string;
  nodeIds: Set<string> | null;
  rowCount: number | null;
  active: boolean;
}

export interface FiltersDerived {
  cypher: CypherStatus;
  cypherMatchSet: Set<string> | null;
  effectiveRoots: string[];
  isAllMode: boolean;
}

export function useFilters(
  index: GraphIndex | null,
): FiltersState & FiltersApi & FiltersDerived {
  const [view, setView] = useState<ViewMode>("tree");
  const [direction, setDirection] = useState<Direction>("forward");
  const [rootIds, setRootIds] = useState<string[]>([]);
  const [contains, setContains] = useState<string[]>([]);
  const [containsAll, setContainsAll] = useState(true);
  const [cypherQuery, setCypherQuery] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const cypher: CypherStatus = useMemo(() => {
    if (!index || !advancedOpen || !cypherQuery.trim()) {
      return { ok: true, nodeIds: null, rowCount: null, active: false };
    }
    try {
      const r = executeCypher(cypherQuery, index);
      return {
        ok: true,
        nodeIds: r.nodeIds,
        rowCount: r.rowCount,
        active: r.nodeIds.size > 0,
      };
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        nodeIds: null,
        rowCount: null,
        active: false,
      };
    }
  }, [index, advancedOpen, cypherQuery]);

  const cypherMatchSet = cypher.active ? cypher.nodeIds : null;

  const effectiveRoots = useMemo(() => {
    if (!index) return [];
    if (cypher.active && cypher.nodeIds) return [...cypher.nodeIds];
    if (rootIds.length > 0) return rootIds;
    const boundary = index.nodes
      .filter((n) =>
        direction === "forward"
          ? (index.incoming[n.id] || []).length === 0
          : (index.outgoing[n.id] || []).length === 0,
      )
      .filter((n) =>
        direction === "forward" ? n.kind === "event" : n.kind !== "event",
      )
      .filter((n) => {
        if (n.kind === "saga" || n.kind === "projection") {
          if (!n.name.includes(".")) return false;
        }
        return true;
      })
      .filter((n) => {
        if (n.kind === "command") {
          if (
            index.outgoing[n.id].length === 0 &&
            index.incoming[n.id].length === 0
          )
            return false;
        }
        return true;
      })
      .map((n) => n.id);
    return boundary.length > 0 ? boundary : index.nodes.map((n) => n.id);
  }, [index, rootIds, direction, cypher]);

  const isAllMode = rootIds.length === 0 && !cypher.active;

  return {
    view,
    direction,
    rootIds,
    contains,
    containsAll,
    cypherQuery,
    advancedOpen,
    setView,
    setDirection,
    setRootIds,
    setContains,
    setContainsAll,
    setCypherQuery,
    setAdvancedOpen,
    cypher,
    cypherMatchSet,
    effectiveRoots,
    isAllMode,
  };
}
