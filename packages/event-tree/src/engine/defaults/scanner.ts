import fs from "node:fs";
import { join } from "node:path";
import type { Engine } from "../engine";

export function applyScannerDefaults(engine: Engine) {
  engine.scan(
    function* (root: string = process.cwd()) {
      yield* fs.globSync("**/*.ts", {
        cwd: root,
        exclude: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/.git/**",
          "**/.turbo/**",
          "**/coverage/**",
          "**/.next/**",
          "**/.cache/**",
          "**/.vite/**",

          "**/*.d.ts",
          "**/*.spec.ts",
          "**/*.test.ts",
          "**/*.typecheck.spec.ts",
        ],
        withFileTypes: false,
      }).map((p) => join(root, p))
    }
  );
}
