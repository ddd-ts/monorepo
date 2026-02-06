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
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
};
