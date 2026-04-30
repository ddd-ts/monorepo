import { useCallback, useEffect, useRef, useState } from "react";
import { useGraph } from "./lib/useGraph.js";
import { useFilters, type ViewMode } from "./lib/useFilters.js";
import { COL, FONT_MONO } from "./lib/tokens.js";
import {
  LinearChainsView,
  type LinearChainsHandle,
} from "./components/LinearChainsView.js";
import { GraphView } from "./components/GraphView.js";
import { FlatView } from "./components/FlatView.js";
import { FilterBar } from "./components/FilterBar.js";
import { InspectorPanel } from "./components/InspectorPanel.js";

export function App() {
  const { index, info } = useGraph();
  const filters = useFilters(index);
  const [inspectId, setInspectId] = useState<string | null>(null);

  const treeHandleRef = useRef<LinearChainsHandle | null>(null);
  const registerHandle = useCallback((h: LinearChainsHandle) => {
    treeHandleRef.current = h;
  }, []);

  // Track which views the user has visited at least once. Each visited view
  // stays mounted (just hidden via display:none) so subsequent switches are
  // instant — the heavy work (mermaid render for graph, large lists for tree
  // / flat) only pays once. Unvisited views aren't mounted at all, so the
  // initial page load only pays for the default view.
  const [visited, setVisited] = useState<Set<ViewMode>>(
    () => new Set([filters.view]),
  );
  useEffect(() => {
    setVisited((prev) =>
      prev.has(filters.view) ? prev : new Set(prev).add(filters.view),
    );
  }, [filters.view]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
      }}
    >
      <Header info={info} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {!index && <LoadingState />}
        {index && (
          <>
            <FilterBar
              index={index}
              filters={filters}
              treeActions={{
                onExpandAll: () => treeHandleRef.current?.expandAll(),
                onCollapseAll: () => treeHandleRef.current?.collapseAll(),
              }}
            />
            <div
              style={{
                flex: 1,
                display: "flex",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {visited.has("tree") && (
                <ViewSlot active={filters.view === "tree"}>
                  <LinearChainsView
                    index={index}
                    direction={filters.direction}
                    effectiveRoots={filters.effectiveRoots}
                    contains={filters.contains}
                    containsAll={filters.containsAll}
                    cypherMatch={filters.cypherMatchSet}
                    inspectId={inspectId}
                    onInspect={setInspectId}
                    registerHandle={registerHandle}
                    isActive={filters.view === "tree"}
                  />
                </ViewSlot>
              )}
              {visited.has("graph") && (
                <ViewSlot active={filters.view === "graph"}>
                  <GraphView
                    index={index}
                    direction={filters.direction}
                    effectiveRoots={filters.effectiveRoots}
                    contains={filters.contains}
                    containsAll={filters.containsAll}
                    cypherMatch={filters.cypherMatchSet}
                    inspectId={inspectId}
                    onInspect={setInspectId}
                    isActive={filters.view === "graph"}
                  />
                </ViewSlot>
              )}
              {visited.has("flat") && (
                <ViewSlot active={filters.view === "flat"}>
                  <FlatView
                    index={index}
                    direction={filters.direction}
                    effectiveRoots={filters.effectiveRoots}
                    contains={filters.contains}
                    containsAll={filters.containsAll}
                    cypherMatch={filters.cypherMatchSet}
                    inspectId={inspectId}
                    onInspect={setInspectId}
                    isActive={filters.view === "flat"}
                  />
                </ViewSlot>
              )}
              {inspectId && (
                <InspectorPanel
                  index={index}
                  nodeId={inspectId}
                  onClose={() => setInspectId(null)}
                  onMakeRoot={(id, dir) => {
                    filters.setDirection(dir);
                    filters.setRootIds([id]);
                    // Clear any active cypher query so the new root takes
                    // effect — otherwise cypher results would override the
                    // rootIds the user just asked us to focus on.
                    filters.setCypherQuery("");
                    setInspectId(null);
                  }}
                  onJump={(id) => setInspectId(id)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  info,
}: {
  info: { fileCount: number; root: string } | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: `0.5px solid ${COL.border}`,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: COL.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={8} height={8} viewBox="0 0 8 8">
            <path
              d="M1 4 L3 6 L7 2"
              stroke="#fff"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: -0.1 }}>
          Effects
        </span>
        <span style={{ color: COL.textFaint, fontSize: 12 }}>· DDD-TS</span>
      </div>
      <div style={{ flex: 1 }} />
      {info && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 10.5,
            color: COL.textFaint,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 480,
          }}
          title={info.root}
        >
          {info.fileCount} files · {trimRoot(info.root)}
        </div>
      )}
    </div>
  );
}

/**
 * Flex slot wrapping each view. When inactive, switches to display:none so
 * the view is hidden but stays mounted (preserves rendered DOM, scroll
 * position, mermaid SVG, etc. across switches).
 */
function ViewSlot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: active ? "flex" : "none",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function trimRoot(root: string): string {
  const parts = root.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return root;
  return ".../" + parts.slice(-3).join("/");
}

function LoadingState() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COL.textFaint,
        fontSize: 12,
        fontFamily: FONT_MONO,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      connecting to parser…
    </div>
  );
}
