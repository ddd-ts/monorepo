export type NodeKind =
  | "command"
  | "event"
  | "effect"
  | "saga"
  | "projection"
  | "policy";

export type EdgeKind = "emits" | "reacts" | "sends";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  file: string;
  line: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ProjectInfo {
  root: string;
  parsedAt: number;
  fileCount: number;
  errorCount: number;
}
