import { getPnpmWorkspaces } from "workspace-tools";
import { config } from "./jest.config";

const workspaces = getPnpmWorkspaces(process.cwd());
const ignore = ["@ddd-ts/tools"];
const toTest = workspaces.filter((w) => !ignore.includes(w.name));

module.exports = {
  coverageReporters: ["json"],
  coveragePathIgnorePatterns: ["/node_modules/"],
  projects: toTest.map(config),
};
