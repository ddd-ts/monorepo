import fs from "node:fs";
import { parseAndWalk, type WalkerEnter } from "oxc-walker";

type Emit = (event: string, data: any) => void

type Walker = (...args: [...Parameters<WalkerEnter>, emit: Emit]) => ReturnType<WalkerEnter>

export const engine = new class Engine {
  walkers: Walker[] = []

  on(walker: Walker) {
    this.walkers.push(walker);
    return this;
  }

  emit: Emit = (event, data) => {}

  run(pattern: string) {
    for (const file of fs.globSync(pattern)) {
      const code = fs.readFileSync(file, "utf8");
      const walkers = this.walkers;
      const emit = this.emit.bind(this);
      parseAndWalk(code, file, {
        enter: function (node, parent, ctx) {
          for (const walker of walkers) walker.call(this, node, parent, ctx, emit);
        },
      });
    }
  }
}

import './defaults';
