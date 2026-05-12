import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(root, "src/client"),
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/rpc": {
        target: "ws://localhost:5175",
        ws: true,
      },
    },
  },
  build: {
    outDir: resolve(root, "dist/client"),
    emptyOutDir: true,
  },
});
