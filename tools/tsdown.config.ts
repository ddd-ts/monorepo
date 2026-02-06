import { defineConfig } from "tsdown";

export default defineConfig({
  cwd: process.cwd(),
  unbundle: true,
  dts: {
    eager: true,
  },
  exports: {
    devExports: true,
  },
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
