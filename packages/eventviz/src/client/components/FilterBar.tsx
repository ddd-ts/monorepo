import type { GraphIndex } from "../lib/graph.js";
import type { FiltersApi, FiltersDerived, FiltersState, ViewMode } from "../lib/useFilters.js";
import { COL, FONT_MONO } from "../lib/tokens.js";
import { CypherQueryBar } from "./CypherQueryBar.js";
import { MustContainPicker } from "./MustContainPicker.js";
import { RootPicker } from "./RootPicker.js";

interface Props {
  index: GraphIndex;
  filters: FiltersState & FiltersApi & FiltersDerived;
  /** Tree-only "Expand all" / "Collapse" buttons. */
  treeActions?: { onExpandAll: () => void; onCollapseAll: () => void };
}

const VIEWS: { id: ViewMode; label: string; sub: string }[] = [
  { id: "tree", label: "Tree", sub: "linear chains" },
  { id: "graph", label: "Graph", sub: "flowchart" },
  { id: "flat", label: "Flat", sub: "table" },
];

export function FilterBar({ index, filters, treeActions }: Props) {
  return (
    <>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `0.5px solid ${COL.border}`,
          display: "flex",
          gap: 16,
          alignItems: "flex-end",
          background: "#fafaf8",
        }}
      >
        <RootPicker
          index={index}
          value={filters.rootIds}
          onChange={filters.setRootIds}
          direction={filters.direction}
          onDirectionChange={filters.setDirection}
        />
        <div style={{ flex: 1.2 }}>
          <MustContainPicker
            index={index}
            value={filters.contains}
            onChange={filters.setContains}
          />
          {filters.contains.length > 1 && (
            <div
              style={{
                display: "inline-flex",
                marginTop: 6,
                padding: 2,
                background: "oklch(0.94 0.005 80)",
                borderRadius: 4,
              }}
            >
              {(
                [
                  ["all", "all of"],
                  ["any", "any of"],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => filters.setContainsAll(k === "all")}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 8px",
                    borderRadius: 3,
                    background:
                      (k === "all") === filters.containsAll
                        ? "#fff"
                        : "transparent",
                    color:
                      (k === "all") === filters.containsAll
                        ? COL.text
                        : COL.textMuted,
                    boxShadow:
                      (k === "all") === filters.containsAll
                        ? "0 1px 2px rgba(0,0,0,0.06)"
                        : "none",
                    font: "inherit",
                    fontSize: 10.5,
                    letterSpacing: 0.2,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => filters.setAdvancedOpen(!filters.advancedOpen)}
            title="Cypher query"
            style={{
              border: `0.5px solid ${
                filters.advancedOpen ? COL.accent : COL.border
              }`,
              background: filters.advancedOpen ? COL.accentSoft : "#fff",
              color: filters.advancedOpen ? COL.accentText : COL.textMuted,
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: filters.advancedOpen ? 600 : 400,
            }}
          >
            Advanced
          </button>
          {treeActions && (
            <>
              <button
                type="button"
                onClick={treeActions.onExpandAll}
                disabled={filters.view !== "tree"}
                style={{
                  border: `0.5px solid ${COL.border}`,
                  background: "#fff",
                  color:
                    filters.view === "tree" ? COL.textMuted : COL.textFaint,
                  padding: "6px 10px",
                  borderRadius: 4,
                  cursor: filters.view === "tree" ? "pointer" : "not-allowed",
                  fontSize: 11,
                  fontFamily: "inherit",
                  opacity: filters.view === "tree" ? 1 : 0.5,
                }}
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={treeActions.onCollapseAll}
                disabled={filters.view !== "tree"}
                style={{
                  border: `0.5px solid ${COL.border}`,
                  background: "#fff",
                  color:
                    filters.view === "tree" ? COL.textMuted : COL.textFaint,
                  padding: "6px 10px",
                  borderRadius: 4,
                  cursor: filters.view === "tree" ? "pointer" : "not-allowed",
                  fontSize: 11,
                  fontFamily: "inherit",
                  opacity: filters.view === "tree" ? 1 : 0.5,
                }}
              >
                Collapse
              </button>
            </>
          )}
        </div>
      </div>

      {filters.advancedOpen && (
        <CypherQueryBar
          value={filters.cypherQuery}
          onChange={filters.setCypherQuery}
          error={filters.cypher.ok ? null : filters.cypher.error ?? null}
          matchCount={
            filters.cypher.ok && filters.cypher.nodeIds
              ? filters.cypher.nodeIds.size
              : null
          }
          rowCount={
            filters.cypher.ok && filters.cypher.rowCount !== null
              ? filters.cypher.rowCount
              : null
          }
        />
      )}

      <StatsLine filters={filters} />
    </>
  );
}



function ViewSelector({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 2,
        background: "oklch(0.94 0.005 80)",
        borderRadius: 4,
      }}
    >
      {VIEWS.map((v) => {
        const active = value === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            title={v.sub}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "4px 12px",
              borderRadius: 3,
              background: active ? "#fff" : "transparent",
              color: active ? COL.text : COL.textMuted,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              font: "inherit",
              fontSize: 11.5,
              fontWeight: active ? 600 : 500,
              letterSpacing: 0.1,
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function StatsLine({
  filters,
}: {
  filters: FiltersState & FiltersApi & FiltersDerived;
}) {
  return (
    <div
      style={{
        padding: "8px 16px",
        borderBottom: `0.5px solid ${COL.border}`,
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontSize: 11,
        fontFamily: FONT_MONO,
        color: COL.textMuted,
        letterSpacing: 0.3,
      }}
    >
      <span
        style={{
          color: COL.textFaint,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {filters.direction === "forward" ? "Tracing from" : "Tracing to"}
      </span>
      <span style={{ color: COL.text, fontWeight: 500 }}>
        {filters.cypher.active
          ? `cypher match · ${filters.effectiveRoots.length} node${filters.effectiveRoots.length === 1 ? "" : "s"}`
          : filters.isAllMode
            ? `all events · ${filters.effectiveRoots.length} root${filters.effectiveRoots.length === 1 ? "" : "s"}`
            : `${filters.rootIds.length} event${filters.rootIds.length === 1 ? "" : "s"}`}
      </span>
      <div style={{ flex: 1 }} />
      <ViewSelector value={filters.view} onChange={filters.setView} />
    </div>
  );
}
