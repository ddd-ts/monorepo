import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import launchEditor from "launch-editor"
import { defineConfig, type PluginOption } from "vite"

function openInEditor(): PluginOption {
  return {
    name: "open-in-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__open-in-editor", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost")
        const file = url.searchParams.get("file")
        if (!file) {
          res.statusCode = 400
          return res.end("missing file")
        }
        const absolute = path.resolve(server.config.root, file)
        if (!fs.existsSync(absolute)) {
          server.config.logger.warn(
            `[open-in-editor] file not found: ${absolute}`,
          )
          res.statusCode = 404
          return res.end(`file not found: ${file}`)
        }
        const offset = Number(url.searchParams.get("offset") ?? "")
        let spec = absolute
        if (Number.isFinite(offset) && offset >= 0) {
          const text = fs.readFileSync(absolute, "utf8")
          const before = text.slice(0, offset)
          const line = before.split("\n").length
          const column = offset - before.lastIndexOf("\n")
          spec = `${absolute}:${line}:${column}`
        }
        launchEditor(spec, (fileName, error) => {
          server.config.logger.error(
            `[open-in-editor] failed to open ${fileName}: ${error}`,
          )
        })
        res.statusCode = 204
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), openInEditor()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
