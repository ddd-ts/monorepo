import { useMemo } from "react";
import { indexGraph, type GraphIndex } from "@/domain/graph";
import { stubGraph } from "./stub-graph";

export function useGraph(): GraphIndex {
  return useMemo(() => indexGraph(stubGraph), []);
}
