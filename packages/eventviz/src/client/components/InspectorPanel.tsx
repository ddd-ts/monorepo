import type { ReactNode } from "react";
import type { GraphEdge } from "../../shared/types.js";
import { type GraphIndex, verbFor } from "../lib/graph.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

interface Props {
  index: GraphIndex;
  nodeId: string | null;
  onClose: () => void;
  onMakeRoot: (id: string, direction: "forward" | "reversed") => void;
  onJump: (id: string) => void;
}

export function InspectorPanel({
  index,
  nodeId,
  onClose,
  onMakeRoot,
  onJump,
}: Props) {
  if (!nodeId) return null;
  const node = index.byId[nodeId];
  if (!node) return null;
  const meta = KIND_META[node.kind];
  const incoming = index.incoming[nodeId] || [];
  const outgoing = index.outgoing[nodeId] || [];

  return (
    <aside
      style={{
        width: 320,
        height: "100%",
        flexShrink: 0,
        borderLeft: `0.5px solid ${COL.border}`,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: `0.5px solid ${COL.border}`,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <KindGlyph kind={node.kind} size={14} />
            <span
              style={{
                fontSize: 10,
                color: COL.textFaint,
                fontFamily: FONT_MONO,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              {meta.label}
            </span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: COL.text,
              letterSpacing: -0.1,
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            {node.name}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: COL.textMuted,
            padding: 4,
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 14px 20px",
        }}
      >
        <Field label="Kind">{meta.label}</Field>
        <Field label="Source" mono copy={`${node.file}:${node.line}`}>
          <button
            type="button"
            onClick={() => onJump(node.id)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              font: "inherit",
              color: COL.accentText,
              textDecoration: "underline",
              textUnderlineOffset: 2,
              textDecorationColor: "oklch(0.85 0.04 250)",
            }}
          >
            {node.file}
            <span style={{ color: COL.textFaint }}>:</span>
            {node.line}
          </button>
        </Field>

        <EdgeSection
          label={`Triggered by (${incoming.length})`}
          empty="nothing — this is an origin"
          edges={incoming}
          side="in"
          index={index}
          onJump={onJump}
        />
        <EdgeSection
          label={`Triggers (${outgoing.length})`}
          empty="nothing — this is terminal"
          edges={outgoing}
          side="out"
          index={index}
          onJump={onJump}
        />
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: `0.5px solid ${COL.border}`,
          background: "#fafaf8",
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: COL.textFaint,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          Trace this node
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <FooterButton onClick={() => onMakeRoot(node.id, "reversed")} title="Show what leads to this node">
            <svg width={12} height={10} viewBox="0 0 12 10">
              <path
                d="M10 5 L2 5 M4.5 2 L2 5 L4.5 8"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Upstream</span>
          </FooterButton>
          <FooterButton onClick={() => onMakeRoot(node.id, "forward")} title="Show what this node leads to">
            <span>Downstream</span>
            <svg width={12} height={10} viewBox="0 0 12 10">
              <path
                d="M2 5 L10 5 M7.5 2 L10 5 L7.5 8"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </FooterButton>
        </div>
      </div>
    </aside>
  );
}

interface FieldProps {
  label: string;
  mono?: boolean;
  copy?: string;
  children: ReactNode;
}

function Field({ label, mono, copy, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: COL.textFaint,
          fontWeight: 500,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: COL.text,
          fontFamily: mono ? FONT_MONO : "inherit",
          wordBreak: "break-all",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ flex: 1 }}>{children}</span>
        {copy && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(copy);
            }}
            title="Copy"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: COL.textFaint,
              padding: 2,
              fontSize: 10,
              fontFamily: "inherit",
              letterSpacing: 0.3,
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            copy
          </button>
        )}
      </div>
    </div>
  );
}

interface EdgeSectionProps {
  label: string;
  empty: string;
  edges: GraphEdge[];
  side: "in" | "out";
  index: GraphIndex;
  onJump: (id: string) => void;
}

function EdgeSection({ label, empty, edges, side, index, onJump }: EdgeSectionProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: COL.textFaint,
          fontWeight: 500,
          marginBottom: 6,
          padding: "0 8px",
        }}
      >
        {label}
      </div>
      {edges.length === 0 ? (
        <div
          style={{
            fontSize: 11.5,
            color: COL.textFaint,
            fontStyle: "italic",
            padding: "4px 8px",
          }}
        >
          {empty}
        </div>
      ) : (
        edges.map((edge, i) => (
          <EdgeRow key={i} edge={edge} side={side} index={index} onJump={onJump} />
        ))
      )}
    </div>
  );
}

interface EdgeRowProps {
  edge: GraphEdge;
  side: "in" | "out";
  index: GraphIndex;
  onJump: (id: string) => void;
}

function EdgeRow({ edge, side, index, onJump }: EdgeRowProps) {
  const otherId = side === "in" ? edge.from : edge.to;
  const other = index.byId[otherId];
  if (!other) return null;
  const verb = verbFor(side === "in" ? "reversed" : "forward", edge.kind);
  return (
    <button
      type="button"
      onClick={() => onJump(otherId)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        padding: "6px 8px",
        border: "none",
        background: "transparent",
        borderRadius: 3,
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "oklch(0.97 0.005 80)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 9,
          color: COL.textFaint,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          minWidth: 64,
          flexShrink: 0,
        }}
      >
        {verb}
      </span>
      <KindGlyph kind={other.kind} size={12} />
      <span
        style={{
          fontSize: 12,
          color: COL.text,
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {other.name}
      </span>
    </button>
  );
}

function FooterButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        flex: 1,
        border: `0.5px solid ${COL.borderStrong}`,
        background: "#fff",
        color: COL.text,
        padding: "8px 10px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}
