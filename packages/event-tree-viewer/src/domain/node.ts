type Source = { file: string; start: number }

export type Node =
  | {
      type: "event"
      name: string
      meta: { alias: string; base: string }
      source: Source
    }
  | { type: "command"; name: string; meta: { base: string }; source: Source }
  | { type: "saga"; name: string; source: Source }
  | { type: "aggregate"; name: string; source: Source }
  | {
      type: "projection"
      name: string
      meta: { alias: string }
      source: Source
    }

export type NodeKind = Node["type"]

export const NODE_KINDS = [
  "event",
  "command",
  "saga",
  "aggregate",
  "projection",
] as const satisfies readonly NodeKind[]
