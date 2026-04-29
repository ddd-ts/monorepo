import { useEffect, useRef } from "react";
import { COL, FONT_MONO } from "../lib/tokens.js";

interface Props {
  value: string;
  onChange: (q: string) => void;
  error: string | null;
  matchCount: number | null;
  rowCount: number | null;
}

export function CypherQueryBar({
  value,
  onChange,
  error,
  matchCount,
  rowCount,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        padding: "10px 16px 12px",
        borderBottom: `0.5px solid ${COL.border}`,
        background: "oklch(0.985 0.003 80)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: COL.textFaint,
            fontWeight: 600,
          }}
        >
          Cypher
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: COL.textFaint,
            fontStyle: "italic",
          }}
        >
          query the graph — labels: Event, Command, Saga, Projection, Effect,
          Policy · types: emits, reacts, sends
        </span>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="MATCH (e:Event)-[:reacts]->(s:Saga) RETURN e, s"
        rows={Math.max(2, value.split("\n").length)}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: `0.5px solid ${error ? "oklch(0.6 0.18 25)" : COL.border}`,
          borderRadius: 4,
          background: "#fff",
          fontFamily: FONT_MONO,
          fontSize: 12,
          color: COL.text,
          outline: "none",
          resize: "vertical",
          lineHeight: 1.5,
          boxSizing: "border-box",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: 0.3,
          minHeight: 14,
        }}
      >
        {error && (
          <span style={{ color: "oklch(0.5 0.18 25)" }}>
            ✗ {error}
          </span>
        )}
        {!error && value.trim() && matchCount !== null && (
          <span style={{ color: COL.textMuted }}>
            <span style={{ color: COL.text, fontWeight: 600 }}>
              {matchCount}
            </span>{" "}
            node{matchCount === 1 ? "" : "s"} match ·{" "}
            <span style={{ color: COL.text }}>{rowCount ?? 0}</span> row
            {rowCount === 1 ? "" : "s"}
          </span>
        )}
        {!error && !value.trim() && (
          <span style={{ color: COL.textFaint, fontStyle: "italic" }}>
            empty query — clear all filters and show full graph
          </span>
        )}
      </div>
    </div>
  );
}
