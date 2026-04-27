import { createBirpc, type BirpcReturn } from "birpc";
import type { ClientFunctions, ServerFunctions } from "../../shared/rpc.js";
import type { Graph, ProjectInfo } from "../../shared/types.js";

export interface RpcClient {
  rpc: BirpcReturn<ServerFunctions, ClientFunctions>;
  onGraph: (cb: (g: Graph) => void) => () => void;
  onInfo: (cb: (i: ProjectInfo) => void) => () => void;
  ready: Promise<void>;
}

export function connect(): RpcClient {
  const url = buildWsUrl();
  let ws: WebSocket | null = null;
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));

  const graphSubs = new Set<(g: Graph) => void>();
  const infoSubs = new Set<(i: ProjectInfo) => void>();

  const clientImpl: ClientFunctions = {
    onGraphUpdated(graph) {
      graphSubs.forEach((s) => s(graph));
    },
    onProjectInfo(info) {
      infoSubs.forEach((s) => s(info));
    },
  };

  let rpc: BirpcReturn<ServerFunctions, ClientFunctions>;

  const setup = () => {
    ws = new WebSocket(url);
    rpc = createBirpc<ServerFunctions, ClientFunctions>(clientImpl, {
      post: (data) => ws?.readyState === WebSocket.OPEN && ws.send(data),
      on: (fn) => {
        ws?.addEventListener("message", (ev) => fn(ev.data));
      },
      serialize: (v) => JSON.stringify(v),
      deserialize: (v) => JSON.parse(v as string),
    });
    ws.addEventListener("open", () => resolveReady());
    ws.addEventListener("close", () => {
      // Reconnect after a short delay
      setTimeout(setup, 800);
    });
    ws.addEventListener("error", () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
    });
  };
  setup();

  return {
    get rpc() {
      return rpc;
    },
    onGraph(cb) {
      graphSubs.add(cb);
      return () => graphSubs.delete(cb);
    },
    onInfo(cb) {
      infoSubs.add(cb);
      return () => infoSubs.delete(cb);
    },
    ready,
  } as RpcClient;
}

function buildWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/rpc`;
}
