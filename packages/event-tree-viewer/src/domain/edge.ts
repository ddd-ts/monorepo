import type { Direction } from "./direction";

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

export type EdgeKind = "reacts" | "sends" | "emits" | "handler-emits";

export function edgeKind(edge: Edge): EdgeKind {
  if (edge.from.type === "event") return "reacts";
  if (edge.from.type === "command") return "handler-emits";
  if (edge.to.type === "command") return "sends";
  return "emits";
}

export function verbFor(direction: Direction, kind: EdgeKind): string {
  if (direction === "forward") {
    if (kind === "reacts") return "triggers";
    if (kind === "sends") return "sends";
    return "emits";
  }
  if (kind === "reacts") return "triggered by";
  if (kind === "sends") return "sent by";
  return "emitted by";
}
