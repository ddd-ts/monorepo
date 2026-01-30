import { Project } from "ts-morph";

const cwd = process.cwd();
const tsConfigFilePath = `${cwd}/tsconfig.json`;

export const project = new Project({
  tsConfigFilePath,
});
