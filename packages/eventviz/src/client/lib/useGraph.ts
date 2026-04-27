import { useEffect, useMemo, useState } from "react";
import { connect, type RpcClient } from "./rpc.js";
import { indexGraph, type GraphIndex } from "./graph.js";
import type { Graph, ProjectInfo } from "../../shared/types.js";

let _client: RpcClient | null = null;
function client(): RpcClient {
  if (!_client) _client = connect();
  return _client;
}

export function useGraph(): {
  graph: Graph | null;
  index: GraphIndex | null;
  info: ProjectInfo | null;
  refresh: () => void;
} {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [info, setInfo] = useState<ProjectInfo | null>(null);

  useEffect(() => {
    const c = client();
    let cancelled = false;
    c.ready.then(async () => {
      if (cancelled) return;
      const [g, i] = await Promise.all([
        c.rpc.getGraph(),
        c.rpc.getProjectInfo(),
      ]);
      if (cancelled) return;
      setGraph(g);
      setInfo(i);
    });
    const offG = c.onGraph((g) => setGraph(g));
    const offI = c.onInfo((i) => setInfo(i));
    return () => {
      cancelled = true;
      offG();
      offI();
    };
  }, []);

  const index = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);

  return {
    graph,
    index,
    info,
    refresh: () => {
      client()
        .rpc.refresh()
        .then((g) => setGraph(g));
    },
  };
}
