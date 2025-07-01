import { exec } from "child_process";
import { Config } from "jest";

type ProjectConfig = Config & {
  globals: {
    CURRENT_WORKSPACE: string;
    CURRENT_WORKSPACE_PATH: string;
    CURRENT_WORKSPACE_PRETEST: string;
    CURRENT_WORKSPACE_WAIT: string;
    CURRENT_WORKSPACE_POSTTEST: string;
  };
};

export default async (_config: Config, projectConfig: ProjectConfig) => {
  const cwd = projectConfig.globals.CURRENT_WORKSPACE_PATH;

  const pretest = projectConfig.globals.CURRENT_WORKSPACE_PRETEST;

  if (!pretest) {
    return;
  }

  const pretestProcess = exec(pretest, { cwd });

  await new Promise<void>((resolve, reject) => {
    pretestProcess.on("error", reject);
    pretestProcess.on("exit", (code) => (code ? reject() : resolve()));
  });

  const wait = projectConfig.globals.CURRENT_WORKSPACE_WAIT;

  if (!wait) {
    return;
  }

  const waitProcess = exec(wait, { cwd });

  await new Promise<void>((resolve, reject) => {
    waitProcess.on("error", reject);
    waitProcess.on("exit", (code) => (code ? reject() : resolve()));
  });
};
