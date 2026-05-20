import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { trpcPlugin } from "./src/server/vite-plugin"

const SCAN_ROOT = path.resolve(process.env.EVENTVIZ_SCAN_ROOT ?? process.cwd())

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), trpcPlugin(SCAN_ROOT)],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
