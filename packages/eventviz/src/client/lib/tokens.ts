import type { NodeKind } from "../../shared/types.js";

export const COL = {
  bg: "#fbfaf8",
  panel: "#ffffff",
  border: "oklch(0.92 0.005 80)",
  borderStrong: "oklch(0.85 0.005 80)",
  text: "oklch(0.25 0.005 80)",
  textMuted: "oklch(0.55 0.005 80)",
  textFaint: "oklch(0.72 0.005 80)",
  accent: "oklch(0.62 0.14 250)",
  accentSoft: "oklch(0.94 0.04 250)",
  accentText: "oklch(0.42 0.14 250)",
  edgeIdle: "oklch(0.85 0.005 80)",
  edgeChain: "oklch(0.62 0.14 250)",
  edgeFaded: "oklch(0.94 0.005 80)",
  kindEvent: "oklch(0.97 0.02 250)",
  kindCommand: "oklch(0.97 0.015 80)",
  kindEffect: "oklch(0.97 0.02 30)",
  kindSaga: "oklch(0.97 0.025 130)",
  kindProjection: "oklch(0.97 0.015 200)",
  kindPolicy: "oklch(0.97 0.02 320)",
} as const;

export const KIND_META: Record<NodeKind, { label: string }> = {
  command: { label: "Command" },
  event: { label: "Event" },
  effect: { label: "Effect" },
  saga: { label: "Saga" },
  projection: { label: "Projection" },
  policy: { label: "Policy" },
};

export const KIND_BG: Record<NodeKind, string> = {
  event: COL.kindEvent,
  command: COL.kindCommand,
  effect: COL.kindEffect,
  saga: COL.kindSaga,
  projection: COL.kindProjection,
  policy: COL.kindPolicy,
};

export const FONT_UI = "Inter, system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";
