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
  optimizeDeps: {
    include: [
      "use-sync-external-store/shim",
      "use-sync-external-store/shim/with-selector",
      "elkjs/lib/elk.bundled.js",
      "@base-ui/react/button",
      "@base-ui/react/checkbox",
      "@base-ui/react/dialog",
      "@base-ui/react/input",
      "@base-ui/react/merge-props",
      "@base-ui/react/popover",
      "@base-ui/react/scroll-area",
      "@base-ui/react/select",
      "@base-ui/react/separator",
      "@base-ui/react/toggle",
      "@base-ui/react/toggle-group",
      "@base-ui/react/use-render",
    ],
  },
})
