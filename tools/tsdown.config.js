// @ts-check

import { execSync } from "node:child_process";

/** @type {import("tsdown").UserConfig} */
export default {
  cwd: process.cwd(),
  unbundle: true,
  dts: false,
  exports: {
    devExports: true,
    customExports(exports, { isPublish }) {
      /** @param {string} jsPath */
      const toDts = (jsPath) =>
        jsPath
          .replace(/^\.\/src\//, "./dist/")
          .replace(/\.(mts|cts|mjs|cjs|tsx?|js)$/, ".d.ts");
      for (const [key, value] of Object.entries(exports)) {
        if (key === "./package.json") continue;
        if (isPublish) {
          if (value && typeof value === "object" && !("types" in value)) {
            const js = value.import || value.require || value.default;
            if (js) exports[key] = { types: toDts(js), ...value };
          }
        } else if (typeof value === "string") {
          exports[key] = { types: value, default: value };
        }
      }
      return exports;
    },
  },
  format: ["cjs", "esm"],
  outExtensions: (ctx) => ({
    js: ctx.format === "es" ? ".mjs" : ".js",
  }),
  hooks: {
    "build:done": async ({ options: { outDir } }) => {
      execSync(`tsc --declaration --emitDeclarationOnly --outDir ${outDir}`, {
        stdio: "inherit",
      });
    },
  },
};
