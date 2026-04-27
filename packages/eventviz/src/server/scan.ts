import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".turbo",
  "coverage",
  ".next",
  ".cache",
  ".vite",
]);

export async function findTsFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  await walk(root, root, out);
  return out;
}

async function walk(root: string, dir: string, out: string[]) {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (IGNORED_DIRS.has(name) || name.startsWith(".") && name !== ".") continue;
    const full = join(dir, name);
    let st: Awaited<ReturnType<typeof stat>>;
    try {
      st = await stat(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      await walk(root, full, out);
    } else if (st.isFile()) {
      if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
        // Skip test/spec/typecheck files — they pollute the graph with no-ops
        const rel = relative(root, full);
        if (
          rel.endsWith(".spec.ts") ||
          rel.endsWith(".test.ts") ||
          rel.endsWith(".typecheck.spec.ts")
        ) continue;
        out.push(full);
      }
    }
  }
}
