#!/usr/bin/env node
import { resolve } from "node:path";
import open from "open";
import { createServer } from "./index.js";

async function main() {
  const args = process.argv.slice(2);
  const projectRoot = resolve(args[0] ?? process.cwd());
  console.log(`[eventviz] Starting server for project: ${projectRoot}`);
  const portArg = args.find((a) => a.startsWith("--port="));
  const port = portArg ? Number(portArg.slice("--port=".length)) : 5175;
  const noOpen = args.includes("--no-open");

  const server = await createServer({ projectRoot, port });
  if (!noOpen) {
    open(`http://localhost:${server.port}`).catch(() => {});
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
