// @ts-check

/** @type {import("tsdown").UserConfig} */
export default {
  cwd: process.cwd(),
  unbundle: true,
  dts: {
    eager: true,
  },
  exports: {
    devExports: true,
  },
  format: ["cjs", "esm"],
  outExtensions: (ctx) => ({
    js: ctx.format === "es" ? ".mjs" : ".js",
    dts: ".d.ts",
  })
};
