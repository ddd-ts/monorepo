import type { Config } from "jest";
import { getPnpmWorkspaces, WorkspaceInfo } from "workspace-tools";

export const config = (workspace: WorkspaceInfo[number]) =>
  ({
    displayName: workspace.name,
    rootDir: `${workspace.path}/src`,
    testEnvironment: "node",
    globals: {
      CURRENT_WORKSPACE: workspace.name,
      CURRENT_WORKSPACE_PATH: workspace.path,
      CURRENT_WORKSPACE_PRETEST: workspace.packageJson.scripts?.pretest,
      CURRENT_WORKSPACE_POSTTEST: workspace.packageJson.scripts?.posttest,
      CURRENT_WORKSPACE_WAIT: workspace.packageJson.scripts?.wait,
    },
    testMatch: ["**/*.spec.ts"],
    globalSetup: "../node_modules/@ddd-ts/tools/jest.setup.ts",
    globalTeardown: "../node_modules/@ddd-ts/tools/jest.teardown.ts",
    transform: {
      "^.+\\.(t|j)sx?$": [
        "../node_modules/@ddd-ts/tools/node_modules/@swc/jest",
        {
          jsc: {
            parser: {
              syntax: "typescript",
              decorators: true,
            },
          },
        },
      ],
    },
  }) satisfies Config;

export default () => {
  const cwd = process.cwd();
  const ws = getPnpmWorkspaces(cwd);
  const current = ws.find((w) => w.path === cwd);

  if (!current) {
    throw new Error("Could not find current workspace");
  }

  return config(current);
};
