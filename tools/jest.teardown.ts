import { exec } from "child_process"
import { Config } from "jest";

type ProjectConfig = Config & {
  globals: {
    CURRENT_WORKSPACE: string;
    CURRENT_WORKSPACE_PATH: string;
    CURRENT_WORKSPACE_PRETEST: string;
    CURRENT_WORKSPACE_WAIT: string;
    CURRENT_WORKSPACE_POSTTEST: string;
  }
}

export default async (_config: Config, projectConfig: ProjectConfig) => {
  const cwd = projectConfig.globals.CURRENT_WORKSPACE_PATH

  const posttest = projectConfig.globals.CURRENT_WORKSPACE_POSTTEST

  if (!posttest) {
    return;
  }

  const posttestProcess = exec(posttest, { cwd })

  await new Promise<void>((resolve, reject) => {
    posttestProcess.on('error', reject)
    posttestProcess.on('exit', (code) => code ? reject() : resolve())
  })
}