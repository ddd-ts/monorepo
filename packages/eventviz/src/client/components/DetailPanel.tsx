import type { GraphEdge, GraphNode } from "../../shared/types.js";
import type { GraphIndex } from "../lib/graph.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

interface Props {
  index: GraphIndex;
  nodeId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function DetailPanel({ index, nodeId, onClose, onSelect }: Props) {
  if (!nodeId) return null;
  const node = index.byId[nodeId];
  if (!node) return null;
  const meta = KIND_META[node.kind];
  const incoming = (index.incoming[node.id] || []).map((e) => ({
    edge: e,
    node: index.byId[e.from],
  }));
  const outgoing = (index.outgoing[node.id] || []).map((e) => ({
    edge: e,
    node: index.byId[e.to],
  }));

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 320,
        maxHeight: "calc(100% - 24px)",
        background: COL.panel,
        border: `0.5px solid ${COL.border}`,
        borderRadius: 6,
        boxShadow:
          "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        fontSize: 13,
        color: COL.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 10,
      }}
    >
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: `0.5px solid ${COL.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color: COL.textMuted,
            }}
          >
            {meta.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: COL.textMuted,
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: -0.1,
            marginBottom: 6,
          }}
        >
          {node.name}
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: COL.textMuted,
          }}
        >
          {node.file}
          <span style={{ color: COL.textFaint }}>:{node.line}</span>
        </div>
      </div>
      <div style={{ padding: "12px 16px", overflowY: "auto", flex: 1 }}>
        <Group
          title="Triggered by"
          items={incoming}
          onSelect={onSelect}
          emptyText="No upstream — this is a source."
        />
        <div style={{ height: 14 }} />
        <Group
          title="Triggers"
          items={outgoing}
          onSelect={onSelect}
          emptyText="No downstream — this is a sink."
        />
      </div>
    </div>
  );
}

interface GroupProps {
  title: string;
  items: { edge: GraphEdge; node: GraphNode | undefined }[];
  onSelect: (id: string) => void;
  emptyText: string;
}

function Group({ title, items, onSelect, emptyText }: GroupProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: COL.textMuted,
          marginBottom: 8,
          fontWeight: 500,
        }}
      >
        {title}{" "}
        <span style={{ color: COL.textFaint, fontWeight: 400 }}>
          · {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: COL.textFaint,
            fontStyle: "italic",
          }}
        >
          {emptyText}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map(({ edge, node }) =>
            node ? (
              <button
                key={edge.from + edge.to + edge.kind}
                type="button"
                onClick={() => onSelect(node.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "6px 8px",
                  borderRadius: 4,
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "background .12s",
                  font: "inherit",
                  color: COL.text,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "oklch(0.97 0.005 80)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <KindGlyph kind={node.kind} />
                <span style={{ flex: 1, fontSize: 12.5 }}>{node.name}</span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    color: COL.textFaint,
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  }}
                >
                  {edge.kind}
                </span>
              </button>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
