import { useState } from "react";
import type { NodeKind } from "../../shared/types.js";
import type { GraphIndex } from "../lib/graph.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

interface Props {
  index: GraphIndex;
}

const KINDS: ("all" | NodeKind)[] = [
  "all",
  "event",
  "command",
  "effect",
  "saga",
  "projection",
  "policy",
];

export function CompactView({ index }: Props) {
  const [filter, setFilter] = useState<"all" | NodeKind>("all");
  const [hover, setHover] = useState<string | null>(null);
  const filtered = index.nodes.filter(
    (n) => filter === "all" || n.kind === filter,
  );
  const counts: Record<string, number> = { all: index.nodes.length };
  for (const k of KINDS.slice(1) as NodeKind[]) {
    counts[k] = index.nodes.filter((n) => n.kind === k).length;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `0.5px solid ${COL.border}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: COL.textFaint,
            marginRight: 8,
          }}
        >
          Kind
        </div>
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "4px 9px",
              borderRadius: 3,
              background: filter === k ? COL.accentSoft : "transparent",
              color: filter === k ? COL.accentText : COL.textMuted,
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {k} <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts[k]}</span>
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
              {["", "Name", "Kind", "Triggered by", "Triggers", "File"].map(
                (h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      fontWeight: 500,
                      fontSize: 9.5,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      color: COL.textFaint,
                      borderBottom: `0.5px solid ${COL.border}`,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((n) => {
              const inc = index.incoming[n.id]?.length || 0;
              const out = index.outgoing[n.id]?.length || 0;
              const isHover = hover === n.id;
              return (
                <tr
                  key={n.id}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    background: isHover ? "oklch(0.97 0.005 80)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `0.5px solid ${COL.border}`,
                      width: 24,
                    }}
                  >
                    <KindGlyph kind={n.kind} />
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `0.5px solid ${COL.border}`,
                      fontWeight: 500,
                      color: COL.text,
                    }}
                  >
                    {n.name}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `0.5px solid ${COL.border}`,
                      fontFamily: FONT_MONO,
                      fontSize: 10,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      color: COL.textMuted,
                    }}
                  >
                    {KIND_META[n.kind].label}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `0.5px solid ${COL.border}`,
                      fontFamily: FONT_MONO,
                      color: inc === 0 ? COL.textFaint : COL.text,
                    }}
                  >
                    {inc === 0 ? "—" : inc}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `0.5px solid ${COL.border}`,
                      fontFamily: FONT_MONO,
                      color: out === 0 ? COL.textFaint : COL.text,
                    }}
                  >
                    {out === 0 ? "—" : out}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      borderBottom: `0.5px solid ${COL.border}`,
                      fontFamily: FONT_MONO,
                      fontSize: 10.5,
                      color: COL.textMuted,
                    }}
                  >
                    {n.file}
                    <span style={{ color: COL.textFaint }}>:{n.line}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "8px 14px",
          borderTop: `0.5px solid ${COL.border}`,
          fontSize: 11,
          color: COL.textFaint,
          fontFamily: FONT_MONO,
          letterSpacing: 0.3,
        }}
      >
        {filtered.length} of {index.nodes.length} nodes · {index.edges.length}{" "}
        edges total
      </div>
    </div>
  );
}
