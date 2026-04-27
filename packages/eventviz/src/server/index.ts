import { createServer as createHttpServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createBirpc } from "birpc";
import chokidar from "chokidar";
import { parseProject } from "./parser.js";
import { findTsFiles } from "./scan.js";
import type { Graph, ProjectInfo } from "../shared/types.js";
import type { ClientFunctions, ServerFunctions } from "../shared/rpc.js";

export interface CreateServerOptions {
  projectRoot: string;
  port?: number;
  staticRoot?: string;
}

export async function createServer(opts: CreateServerOptions) {
  const root = resolve(opts.projectRoot);
  const port = opts.port ?? 5175;
  const staticRoot = opts.staticRoot
    ? resolve(opts.staticRoot)
    : defaultStaticRoot();

  let graph: Graph = { nodes: [], edges: [] };
  let info: ProjectInfo = {
    root,
    parsedAt: 0,
    fileCount: 0,
    errorCount: 0,
  };

  async function reparse(): Promise<Graph> {
    const files = await findTsFiles(root);
    const result = await parseProject({ root, files });
    graph = result.graph;
    info = {
      root,
      parsedAt: Date.now(),
      fileCount: files.length,
      errorCount: result.errors.length,
    };
    if (result.errors.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[eventviz] ${result.errors.length} file(s) failed to parse`,
      );
    }
    return graph;
  }

  await reparse();

  const http = createHttpServer(async (req, res) => {
    if (!req.url || req.url === "/rpc") {
      res.writeHead(404);
      res.end();
      return;
    }
    if (!staticRoot) {
      res.writeHead(404);
      res.end("client bundle missing");
      return;
    }
    try {
      await serveStatic(staticRoot, req.url, res);
    } catch {
      res.writeHead(500);
      res.end();
    }
  });

  const wss = new WebSocketServer({ server: http, path: "/rpc" });
  const clients = new Set<{
    rpc: ReturnType<typeof createBirpc<ClientFunctions, ServerFunctions>>;
  }>();

  wss.on("connection", (ws) => {
    const serverImpl: ServerFunctions = {
      async getGraph() {
        return graph;
      },
      async getProjectInfo() {
        return info;
      },
      async refresh() {
        return reparse();
      },
    };
    const rpc = createBirpc<ClientFunctions, ServerFunctions>(serverImpl, {
      post: (data) => ws.send(data),
      on: (fn) => ws.on("message", (raw) => fn(raw.toString())),
      serialize: (v) => JSON.stringify(v),
      deserialize: (v) => JSON.parse(v as string),
    });
    const client = { rpc };
    clients.add(client);
    ws.on("close", () => clients.delete(client));
    rpc.onProjectInfo(info).catch(() => {});
  });

  const watcher = chokidar.watch(root, {
    ignored: /(node_modules|dist|build|\.git|\.turbo|coverage)/,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });

  let pending: NodeJS.Timeout | null = null;
  const scheduleReparse = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => {
      pending = null;
      await reparse();
      for (const c of clients) {
        c.rpc.onGraphUpdated(graph).catch(() => {});
        c.rpc.onProjectInfo(info).catch(() => {});
      }
    }, 200);
  };

  watcher.on("add", (p) => {
    if (p.endsWith(".ts")) scheduleReparse();
  });
  watcher.on("change", (p) => {
    if (p.endsWith(".ts")) scheduleReparse();
  });
  watcher.on("unlink", (p) => {
    if (p.endsWith(".ts")) scheduleReparse();
  });

  return new Promise<{ port: number; close: () => Promise<void> }>(
    (resolveStart) => {
      http.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`[eventviz] listening on http://localhost:${port}`);
        resolveStart({
          port,
          close: () =>
            new Promise<void>((r) => {
              watcher.close();
              wss.close();
              http.close(() => r());
            }),
        });
      });
    },
  );
}

function defaultStaticRoot(): string | undefined {
  // Production layout:  dist/server/cli.mjs  +  dist/client/index.html
  try {
    const here = fileURLToPath(import.meta.url);
    return resolve(here, "..", "..", "client");
  } catch {
    return undefined;
  }
}

async function serveStatic(root: string, urlPath: string, res: any) {
  const cleaned = urlPath.split("?")[0].split("#")[0];
  const candidates = [
    cleaned === "/" ? "index.html" : cleaned.replace(/^\//, ""),
    "index.html",
  ];
  for (const c of candidates) {
    const full = join(root, c);
    try {
      const s = await stat(full);
      if (!s.isFile()) continue;
      const buf = await readFile(full);
      res.writeHead(200, {
        "content-type": mime(extname(full)),
        "content-length": buf.length,
      });
      res.end(buf);
      return;
    } catch {
      // try next
    }
  }
  res.writeHead(404);
  res.end();
}

function mime(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript";
    case ".css":
      return "text/css";
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
