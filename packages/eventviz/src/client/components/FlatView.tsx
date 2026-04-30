import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeKind } from "../../shared/types.js";
import { computeDomains, type GraphIndex } from "../lib/graph.js";
import { computeVisibleSubgraph } from "../lib/subgraph.js";
import type { Direction } from "../lib/useFilters.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";
import { colorizeName } from "../lib/semantics.js";
import { KindGlyph } from "./KindGlyph.js";

const KINDS: ("all" | NodeKind)[] = [
  "all",
  "event",
  "command",
  "effect",
  "saga",
  "projection",
  "policy",
];

interface Props {
  index: GraphIndex;
  direction: Direction;
  effectiveRoots: string[];
  contains: string[];
  containsAll: boolean;
  cypherMatch: Set<string> | null;
  inspectId: string | null;
  onInspect: (id: string) => void;
  isActive: boolean;
}

export function FlatView({
  index,
  direction,
  effectiveRoots,
  contains,
  containsAll,
  cypherMatch,
  inspectId,
  onInspect,
  isActive,
}: Props) {
  const [kindFilter, setKindFilter] = useState<"all" | NodeKind>("all");
  const [hover, setHover] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll the inspected row into view whenever this view becomes active.
  useEffect(() => {
    if (!isActive || !inspectId) return;
    let attempts = 0;
    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const root = scrollContainerRef.current;
      if (!root) return;
      const escaped =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(inspectId)
          : inspectId.replace(/"/g, '\\"');
      const el = root.querySelector<HTMLElement>(
        `tr[data-node-id="${escaped}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        return;
      }
      if (attempts++ < 10) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const domainByNodeId = useMemo(
    () => computeDomains(index.nodes),
    [index],
  );

  const visibleNodes = useMemo(() => {
    const sub = computeVisibleSubgraph({
      index,
      roots: effectiveRoots,
      direction,
      mustContain: contains,
      mustContainAll: containsAll,
    });
    return [...sub.nodes]
      .map((id) => index.byId[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index, effectiveRoots, direction, contains, containsAll]);

  const filtered = visibleNodes.filter(
    (n) => kindFilter === "all" || n.kind === kindFilter,
  );
  const counts: Record<string, number> = { all: visibleNodes.length };
  for (const k of KINDS.slice(1) as NodeKind[]) {
    counts[k] = visibleNodes.filter((n) => n.kind === k).length;
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
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
            onClick={() => setKindFilter(k)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "4px 9px",
              borderRadius: 3,
              background: kindFilter === k ? COL.accentSoft : "transparent",
              color: kindFilter === k ? COL.accentText : COL.textMuted,
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {k}{" "}
            <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts[k] ?? 0}</span>
          </button>
        ))}
      </div>
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto" }}>
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
          <tbody
            onClick={(e) => {
              const tr = (e.target as HTMLElement).closest(
                "tr[data-node-id]",
              ) as HTMLElement | null;
              const id = tr?.getAttribute("data-node-id");
              if (id) onInspect(id);
            }}
            onMouseOver={(e) => {
              const tr = (e.target as HTMLElement).closest(
                "tr[data-node-id]",
              ) as HTMLElement | null;
              const id = tr?.getAttribute("data-node-id");
              setHover(id ?? null);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {filtered.map((n) => {
              const inc = index.incoming[n.id]?.length || 0;
              const out = index.outgoing[n.id]?.length || 0;
              const isHover = hover === n.id;
              const isSelected = inspectId === n.id;
              const isMatch = cypherMatch?.has(n.id);
              return (
                <tr
                  key={n.id}
                  data-node-id={n.id}
                  style={{
                    background: isSelected
                      ? COL.accentSoft
                      : isHover
                        ? "oklch(0.97 0.005 80)"
                        : "transparent",
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
                      color: isSelected ? COL.accentText : COL.text,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>{colorizeName(n.name, domainByNodeId.get(n.id))}</span>
                      {isMatch && (
                        <span
                          title="Matched by Cypher query"
                          style={{
                            fontFamily: FONT_MONO,
                            fontSize: 8.5,
                            color: COL.accentText,
                            background: "#fff",
                            border: `0.5px solid ${COL.accent}`,
                            padding: "1px 5px",
                            borderRadius: 3,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                          }}
                        >
                          match
                        </span>
                      )}
                    </div>
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
        {filtered.length} of {visibleNodes.length} visible · {index.nodes.length}{" "}
        in graph
      </div>
    </div>
  );
}
