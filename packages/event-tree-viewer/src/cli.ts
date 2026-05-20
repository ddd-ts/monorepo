#!/usr/bin/env node

import path from "node:path";
import { styleText } from "node:util"
import { createServer } from "vite";

const dirname = typeof __dirname === "undefined" ? path.dirname(new URL(import.meta.url).pathname) : __dirname;

const vite = await createServer({
  configFile: path.resolve(dirname, "../vite.config.ts"),
});

const server = await vite.listen(20031);

const SCAN_ROOT = path.resolve(
  process.env.EVENTVIZ_SCAN_ROOT ?? process.cwd(),
);

console.log(styleText(['bold', 'underline'], "Event Tree Viewer"))
console.log(`  Status  ${styleText("green", "running")}`)
console.log(`  URL     ${styleText("cyan", server.resolvedUrls?.local[0] ?? "unknown")}`)
console.log(`  Root    ${styleText("yellow", SCAN_ROOT)}`)
console.log()
console.log(styleText("dim", "Press Ctrl+C to stop the server"))
