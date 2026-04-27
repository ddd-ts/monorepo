import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphIndex } from "../lib/graph.js";
import { COL, KIND_META } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

interface Props {
  index: GraphIndex;
  value: string[];
  onChange: (next: string[]) => void;
  direction: "forward" | "reversed";
  onDirectionChange: (d: "forward" | "reversed") => void;
}

export function RootPicker({
  index,
  value,
  onChange,
  direction,
  onDirectionChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const candidates = useMemo(() => {
    const list = index.nodes.filter((n) => {
      if (value.includes(n.id)) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      const ab =
        direction === "forward"
          ? (index.incoming[a.id] || []).length === 0
          : (index.outgoing[a.id] || []).length === 0;
      const bb =
        direction === "forward"
          ? (index.incoming[b.id] || []).length === 0
          : (index.outgoing[b.id] || []).length === 0;
      if (ab !== bb) return ab ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return list.slice(0, 12);
  }, [index, value, query, direction]);

  const add = (id: string) => {
    onChange([...value, id]);
    setQuery("");
    inputRef.current?.focus();
  };
  const remove = (id: string) => onChange(value.filter((v) => v !== id));
  const clear = () => onChange([]);

  const [prefixHover, setPrefixHover] = useState(false);
  const [prefixOpen, setPrefixOpen] = useState(false);
  const prefixRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (prefixRef.current && !prefixRef.current.contains(e.target as Node))
        setPrefixOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const prefixLabel = direction === "forward" ? "From" : "To";
  const prefixHint =
    direction === "forward" ? "what do these trigger?" : "what triggered these?";
  const isAll = value.length === 0;

  return (
    <div ref={ref} style={{ flex: 1, position: "relative", minWidth: 360 }}>
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: COL.textFaint,
          marginBottom: 4,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>Trace</span>
        <span
          style={{
            color: COL.textFaint,
            opacity: 0.6,
            textTransform: "none",
            letterSpacing: 0,
            fontStyle: "italic",
            fontSize: 10,
          }}
        >
          — {prefixHint}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          minHeight: 32,
          border: `0.5px solid ${COL.border}`,
          borderRadius: 4,
          background: COL.bg,
          overflow: "visible",
        }}
      >
        <div ref={prefixRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setPrefixOpen((v) => !v)}
            onMouseEnter={() => setPrefixHover(true)}
            onMouseLeave={() => setPrefixHover(false)}
            title={`Direction: ${prefixLabel.toLowerCase()} (click to flip)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: "100%",
              minHeight: 32,
              padding: "0 10px 0 12px",
              border: "none",
              borderRight: `0.5px solid ${COL.border}`,
              background:
                prefixHover || prefixOpen
                  ? "oklch(0.96 0.005 80)"
                  : "oklch(0.985 0.003 80)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: COL.text,
              letterSpacing: 0.1,
              borderTopLeftRadius: 3.5,
              borderBottomLeftRadius: 3.5,
            }}
          >
            {prefixLabel}
            <svg
              width={9}
              height={9}
              viewBox="0 0 9 9"
              style={{ marginLeft: 2, color: COL.textFaint }}
            >
              <path
                d="M2 3 L4.5 6 L7 3"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {prefixOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                background: "#fff",
                border: `0.5px solid ${COL.border}`,
                borderRadius: 4,
                boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                zIndex: 30,
                minWidth: 220,
              }}
            >
              {(
                [
                  ["forward", "From", "follow what this triggers →"],
                  ["reversed", "To", "← trace back what triggered this"],
                ] as const
              ).map(([k, lbl, sub]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    onDirectionChange(k);
                    setPrefixOpen(false);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    borderLeft:
                      direction === k
                        ? `2px solid ${COL.accent}`
                        : "2px solid transparent",
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
                      fontSize: 12,
                      fontWeight: direction === k ? 600 : 500,
                      color: COL.text,
                    }}
                  >
                    {lbl}
                  </span>
                  <span style={{ fontSize: 10.5, color: COL.textFaint }}>
                    {sub}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          onClick={() => {
            setOpen(true);
            inputRef.current?.focus();
          }}
          style={{
            flex: 1,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
            padding: "4px 6px",
            cursor: "text",
            minWidth: 0,
          }}
        >
          {isAll && !open && query === "" && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px 3px 6px",
                background: "oklch(0.96 0.005 80)",
                borderRadius: 3,
                fontSize: 11.5,
                color: COL.textMuted,
                fontStyle: "italic",
              }}
            >
              <svg width={11} height={11} viewBox="0 0 11 11" style={{ opacity: 0.7 }}>
                <circle cx={3} cy={3} r={1.2} fill={COL.textMuted} />
                <circle cx={8} cy={3} r={1.2} fill={COL.textMuted} />
                <circle cx={3} cy={8} r={1.2} fill={COL.textMuted} />
                <circle cx={8} cy={8} r={1.2} fill={COL.textMuted} />
              </svg>
              all events
            </span>
          )}
          {value.map((id) => {
            const n = index.byId[id];
            if (!n) return null;
            return (
              <span
                key={id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 4px 3px 7px",
                  background: COL.accentSoft,
                  color: COL.accentText,
                  borderRadius: 3,
                  fontSize: 11.5,
                  fontWeight: 500,
                }}
              >
                <KindGlyph kind={n.kind} size={12} />
                <span>{n.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(id);
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: COL.accentText,
                    padding: 0,
                    marginLeft: 1,
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
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && query === "" && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            placeholder={
              isAll ? (open ? "search events…" : "") : open ? "add another…" : ""
            }
            style={{
              flex: 1,
              minWidth: 80,
              border: "none",
              outline: "none",
              background: "transparent",
              font: "inherit",
              fontSize: 12,
              color: COL.text,
              padding: "2px 2px",
            }}
          />
          {!isAll && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              title="Clear — show all events"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: COL.textFaint,
                fontSize: 10.5,
                padding: "2px 6px",
                fontFamily: "inherit",
                letterSpacing: 0.3,
                textTransform: "uppercase",
              }}
            >
              clear
            </button>
          )}
        </div>
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
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {candidates.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => add(n.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 10px",
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
              <span
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9.5,
                  color: COL.textFaint,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                {KIND_META[n.kind].label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
