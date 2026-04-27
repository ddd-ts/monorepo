import { useEffect, useRef, useState } from "react";
import type { GraphIndex } from "../lib/graph.js";
import { COL } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

interface Props {
  index: GraphIndex;
  value: string[];
  onChange: (next: string[]) => void;
}

export function MustContainPicker({ index, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const candidates = index.nodes
    .filter((n) => {
      if (value.includes(n.id)) return false;
      if (!query) return true;
      return n.name.toLowerCase().includes(query.toLowerCase());
    })
    .slice(0, 8);

  return (
    <div ref={ref} style={{ flex: 1, position: "relative", minWidth: 200 }}>
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: COL.textFaint,
          marginBottom: 4,
          fontWeight: 500,
        }}
      >
        Must contain
      </div>
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
          minHeight: 32,
          padding: 4,
          border: `0.5px solid ${COL.border}`,
          borderRadius: 4,
          background: COL.bg,
          cursor: "text",
        }}
      >
        {value.map((id) => {
          const n = index.byId[id];
          if (!n) return null;
          return (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 4px 2px 6px",
                background: COL.accentSoft,
                color: COL.accentText,
                borderRadius: 3,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <KindGlyph kind={n.kind} />
              {n.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((v) => v !== id));
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: COL.accentText,
                  padding: 0,
                  marginLeft: 2,
                  fontSize: 13,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? "any node downstream" : ""}
          style={{
            flex: 1,
            minWidth: 100,
            border: "none",
            outline: "none",
            background: "transparent",
            font: "inherit",
            fontSize: 12,
            color: COL.text,
            padding: "2px 4px",
          }}
        />
      </div>
      {open && candidates.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "#fff",
            border: `0.5px solid ${COL.border}`,
            borderRadius: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            zIndex: 20,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {candidates.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                onChange([...value, n.id]);
                setQuery("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 10px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
                fontSize: 12,
                color: COL.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "oklch(0.97 0.005 80)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <KindGlyph kind={n.kind} />
              <span style={{ flex: 1 }}>{n.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
