import fs from "node:fs";
import { parseAndWalk, type WalkerEnter } from "oxc-walker";
import type { Node } from "../node";
import type { Edge } from "../edge";

type AstWalker = (...args: [...Parameters<WalkerEnter>, file: string]) => ReturnType<WalkerEnter>

export class Engine {
  private astWalkers: AstWalker[] = []

  on(walker: AstWalker) {
    this.astWalkers.push(walker);
    return this;
  }

  private fileScanner: (root: string) => Iterable<string> = function* () {
    console.warn(`No file scanner configured for event-tree engine. Please call engine.scan() with a file scanner function.`);
  };
  scan(fileScanner: (root: string) => Iterable<string>) {
    this.fileScanner = fileScanner;
    return this;
  }

  private edges: Edge[] = [];
  saveEdge(edge: Edge) {
    this.edges.push(edge);
  }
  getEdges(): readonly Edge[] {
    return this.edges;
  }

  private nodes: Node[] = [];
  saveNode(node: Node) {
    this.nodes.push(node);
  }
  getNodes(): readonly Node[] {
    return this.nodes;
  }

  reset() {
    this.edges = [];
    this.nodes = [];
  }

  run(root: string = process.cwd()) {
    for (const file of this.fileScanner(root)) {
      const code = fs.readFileSync(file, "utf8");
      const walkers = this.astWalkers;
      parseAndWalk(code, file, {
        enter: function (node, parent, ctx) {
          for (const walker of walkers) {
            try {
              walker.call(this, node, parent, ctx, file);
            } catch (error) {
              console.error(`Error occurred while walking node in file ${file}:`, error);
            }
          }
        },
      });
    }
  }
}

export const engine = new Engine();

await import('./defaults');
