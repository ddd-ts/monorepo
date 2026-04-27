import type { NodeKind } from "../../shared/types.js";
import { COL } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

const ITEMS: { kind: NodeKind; label: string }[] = [
  { kind: "command", label: "Command" },
  { kind: "event", label: "Event" },
  { kind: "effect", label: "Effect" },
  { kind: "saga", label: "Saga" },
  { kind: "projection", label: "Projection" },
  { kind: "policy", label: "Policy" },
];

export function Legend() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        right: 12,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        border: `0.5px solid ${COL.border}`,
        borderRadius: 5,
        fontSize: 11,
        color: COL.textMuted,
        display: "flex",
        flexDirection: "column",
        gap: 5,
        zIndex: 5,
      }}
    >
      {ITEMS.map((i) => (
        <div
          key={i.kind}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <KindGlyph kind={i.kind} />
          <span>{i.label}</span>
        </div>
      ))}
    </div>
  );
}
