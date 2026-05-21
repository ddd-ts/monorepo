import fs from "node:fs"
import path from "node:path"
import { initTRPC, TRPCError } from "@trpc/server"
import launchEditor from "launch-editor"
import { z } from "zod"
import { engine, type Edge, type Node } from "@ddd-ts/event-tree"

const t = initTRPC.create()

export interface Graph {
  nodes: readonly Node[]
  edges: readonly Edge[]
}

let cache: { root: string; graph: Graph } | null = null

function scan(root: string): Graph {
  if (cache && cache.root === root) return cache.graph
  engine.reset()
  engine.run(root)
  const toRel = (file: string) =>
    path.isAbsolute(file) ? path.relative(root, file) : file
  const nodes = engine.getNodes().map((n) => ({
    ...n,
    source: { ...n.source, file: toRel(n.source.file) },
  })) as Node[]
  const edges = engine.getEdges().map((e) => ({
    ...e,
    source: { ...e.source, file: toRel(e.source.file) },
  })) as Edge[]
  const graph: Graph = { nodes, edges }
  cache = { root, graph }
  return graph
}

export function invalidate() {
  cache = null
}

export function createRouter(scanRoot: string) {
  return t.router({
    graph: t.router({
      get: t.procedure.query(() => scan(scanRoot)),
    }),
    editor: t.router({
      open: t.procedure
        .input(
          z.object({
            file: z.string().min(1),
            offset: z.number().int().nonnegative().optional(),
          })
        )
        .mutation(({ input }) => {
          const absolute = path.isAbsolute(input.file)
            ? input.file
            : path.resolve(scanRoot, input.file)
          if (!fs.existsSync(absolute)) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `file not found: ${input.file}`,
            })
          }
          let spec = absolute
          if (input.offset != null) {
            const text = fs.readFileSync(absolute, "utf8")
            const before = text.slice(0, input.offset)
            const line = before.split("\n").length
            const column = input.offset - before.lastIndexOf("\n")
            spec = `${absolute}:${line}:${column}`
          }
          return new Promise<{ ok: true }>((resolve, reject) => {
            launchEditor(spec, (fileName, error) => {
              reject(
                new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: `launch-editor failed for ${fileName}: ${error}`,
                })
              )
            })
            queueMicrotask(() => resolve({ ok: true }))
          })
        }),
    }),
  })
}

export type AppRouter = ReturnType<typeof createRouter>
