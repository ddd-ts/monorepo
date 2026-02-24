// @ts-check

import { execSync } from "node:child_process";

/** @type {import("tsdown").UserConfig} */
export default {
  cwd: process.cwd(),
  unbundle: true,
  dts: false,
  exports: {
    devExports: true,
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
