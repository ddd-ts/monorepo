const { getPnpmWorkspaces } = require("workspace-tools");
const { config } = require("./jest.config");

const workspaces = getPnpmWorkspaces(process.cwd());
const ignore = ["@ddd-ts/tools"];
const toTest = workspaces.filter((w) => !ignore.includes(w.name));

module.exports = {
  coverageReporters: ["json"],
  coveragePathIgnorePatterns: ["/node_modules/"],
  projects: toTest.map(config),
};
