import path from "node:path"
import type { PluginOption, ViteDevServer } from "vite"

function nodeRequestToFetch(
  req: import("node:http").IncomingMessage,
  base: string
): Request {
  const url = new URL(req.url ?? "/", base)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv))
    else headers.set(k, v)
  }
  const init: RequestInit = { method: req.method, headers }
  if (req.method && !["GET", "HEAD"].includes(req.method)) {
    const chunks: Buffer[] = []
    return new Request(url, {
      ...init,
      body: new ReadableStream({
        start(controller) {
          req.on("data", (c) => chunks.push(c))
          req.on("end", () => {
            controller.enqueue(Buffer.concat(chunks))
            controller.close()
          })
          req.on("error", (e) => controller.error(e))
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" })
  }
  return new Request(url, init)
}

async function writeFetchResponseToNode(
  fetchRes: Response,
  res: import("node:http").ServerResponse
) {
  res.statusCode = fetchRes.status
  fetchRes.headers.forEach((v, k) => res.setHeader(k, v))
  if (fetchRes.body) {
    const reader = fetchRes.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  }
  res.end()
}

export function trpcPlugin(scanRoot: string): PluginOption {
  return {
    name: "event-tree-trpc",
    apply: "serve",
    async configureServer(server: ViteDevServer) {
      const [{ createRouter, invalidate, invalidateEngine }, { fetchRequestHandler }] =
        await Promise.all([
          server.ssrLoadModule("/src/server/router.ts") as Promise<
            typeof import("./router")
          >,
          import("@trpc/server/adapters/fetch"),
        ])
      const router = createRouter(scanRoot)
      const endpoint = "/trpc"

      server.middlewares.use(endpoint, async (req, res) => {
        try {
          req.url = endpoint + (req.url ?? "")
          const request = nodeRequestToFetch(
            req,
            `http://${req.headers.host ?? "localhost"}`
          )
          const response = await fetchRequestHandler({
            endpoint,
            req: request,
            router,
          })
          await writeFetchResponseToNode(response, res)
        } catch (error) {
          server.config.logger.error(
            `[event-tree-trpc] ${(error as Error).message}`
          )
          res.statusCode = 500
          res.end(String(error))
        }
      })

      server.watcher.add(path.resolve(scanRoot, "**/*.ts"))
      const configPrefix = path.resolve(scanRoot, ".config/ddd-ts/event-tree.")
      const isConfigFile = (file: string) => file.startsWith(configPrefix)
      const onChange = (file: string) => {
        if (isConfigFile(file)) {
          invalidateEngine()
          return
        }
        if (file.startsWith(scanRoot)) invalidate()
      }
      server.watcher.on("change", onChange)
      server.watcher.on("add", onChange)
      server.watcher.on("unlink", onChange)
    },
  }
}
