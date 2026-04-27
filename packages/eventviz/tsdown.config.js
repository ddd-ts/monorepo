// @ts-check

/** @type {import("tsdown").UserConfig} */
export default {
  cwd: process.cwd(),
  unbundle: true,
  dts: false,
  exports: false,
  format: ["esm"],
  outExtensions: () => ({ js: ".mjs" }),
};
