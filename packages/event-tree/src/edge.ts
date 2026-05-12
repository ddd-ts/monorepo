type EventRef = { type: "event"; name: string };
type CommandRef = { type: "command"; name: string };
type Reactor = { type: "saga" | "aggregate" | "projection"; name: string; method: string };
type Sender = { type: "saga" | "aggregate"; name: string; method: string };

type Source = { file: string; start: number };

export type Edge =
  | { from: EventRef; to: Reactor; source: Source }
  | { from: Sender; to: CommandRef; source: Source }
  | { from: Sender; to: EventRef; source: Source }
  | { from: CommandRef; to: EventRef; source: Source };
