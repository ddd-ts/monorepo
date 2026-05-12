import { useMemo } from "react";
import { computeDomains, type NodeDomain } from "@/domain/domain-grouping";
import type { GraphIndex, NodeId } from "@/domain/graph";

export type DomainMap = ReadonlyMap<NodeId, NodeDomain>;

export function useDomains(index: GraphIndex): DomainMap {
  return useMemo(() => computeDomains(index.graph.nodes), [index]);
}
