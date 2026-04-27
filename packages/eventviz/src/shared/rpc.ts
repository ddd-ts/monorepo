import type { Graph, ProjectInfo } from "./types.js";

export interface ServerFunctions {
  getGraph(): Promise<Graph>;
  getProjectInfo(): Promise<ProjectInfo>;
  refresh(): Promise<Graph>;
}

export interface ClientFunctions {
  onGraphUpdated(graph: Graph): void;
  onProjectInfo(info: ProjectInfo): void;
}
