import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  collectDescendants,
  computeDomains,
  type GraphIndex,
  verbFor,
} from "../lib/graph.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";
import { RootPicker } from "./RootPicker.js";
import { MustContainPicker } from "./MustContainPicker.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { CypherQueryBar } from "./CypherQueryBar.js";
import { executeCypher } from "../lib/cypher.js";
import type { GraphEdge } from "../../shared/types.js";

interface Props {
  index: GraphIndex;
}

export function LinearChainsView({ index }: Props) {
  const [direction, setDirection] = useState<"forward" | "reversed">("forward");
  const [rootIds, setRootIds] = useState<string[]>([]);
  const [contains, setContains] = useState<string[]>([]);
  const [containsAll, setContainsAll] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(
    () => new Set(),
  );
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cypherQuery, setCypherQuery] = useState("");

  const cypherResult = useMemo(() => {
    if (!advancedOpen || !cypherQuery.trim()) {
      return { ok: true as const, nodeIds: null, rowCount: null };
    }
    try {
      const r = executeCypher(cypherQuery, index);
      return {
        ok: true as const,
        nodeIds: r.nodeIds,
        rowCount: r.rowCount,
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [advancedOpen, cypherQuery, index]);

  const cypherActive =
    advancedOpen &&
    cypherResult.ok &&
    cypherResult.nodeIds !== null &&
    cypherResult.nodeIds.size > 0;

  const setExp = useCallback((key: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const effectiveRoots = useMemo(() => {
    if (cypherActive && cypherResult.ok && cypherResult.nodeIds) {
      return [...cypherResult.nodeIds];
    }
    if (rootIds.length > 0) return rootIds;
    const boundary = index.nodes
      .filter((n) =>
        direction === "forward"
          ? (index.incoming[n.id] || []).length === 0
          : (index.outgoing[n.id] || []).length === 0,
      )
      .filter((n) => {
        if (direction === "forward") return n.kind === "event";
        else return n.kind !== "event";
      })
      .filter((n) => {
        if (n.kind === "saga" || n.kind === "projection") {
          if (!n.name.includes(".")) return false; // filter out top-level sagas/projections, which are often just containers
        }
        return true;
      })
      .filter((n) => {
        if (n.kind === "command") {
          if (index.outgoing[n.id].length === 0 && index.incoming[n.id].length === 0) return false; // filter out orphan commands, which are often just data structures
        }
        return true;
      })
      .map((n) => n.id);
    return boundary.length > 0 ? boundary : index.nodes.map((n) => n.id);
  }, [index, rootIds, direction, cypherActive, cypherResult]);

  const expandAll = () => {
    const next = new Set(expanded);
    const walk = (id: string, pathIds: string[]) => {
      const path = pathIds.join("/") + "/" + id;
      next.add(path);
      const edges =
        direction === "forward"
          ? index.outgoing[id] || []
          : index.incoming[id] || [];
      for (const e of edges) {
        const child = direction === "forward" ? e.to : e.from;
        if (pathIds.includes(child) || child === id) continue;
        walk(child, [...pathIds, id]);
      }
    };
    for (const r of effectiveRoots) walk(r, []);
    setExpanded(next);
    setCollapsedDomains(new Set());
  };
  useLayoutEffect(() => { expandAll(); }, [direction]); // auto-expand on first load
  const collapseAll = () => {
    setExpanded(new Set());
    const allDomainKeys = new Set<string>();
    for (const r of effectiveRoots) {
      const d = domainByNodeId.get(r);
      if (d) allDomainKeys.add(d.key);
    }
    setCollapsedDomains(allDomainKeys);
  };

  const domainByNodeId = useMemo(
    () => computeDomains(index.nodes),
    [index],
  );
  const groupedRoots = useMemo(() => {
    const groups: { key: string; label: string; rootIds: string[] }[] = [];
    const indexByKey = new Map<string, number>();
    for (const rid of effectiveRoots) {
      const d = domainByNodeId.get(rid) ?? { key: "·", label: "·" };
      let i = indexByKey.get(d.key);
      if (i === undefined) {
        i = groups.length;
        indexByKey.set(d.key, i);
        groups.push({ key: d.key, label: d.label, rootIds: [] });
      }
      groups[i].rootIds.push(rid);
    }
    groups.sort((a, b) => a.label.localeCompare(b.label));
    return groups;
  }, [effectiveRoots, domainByNodeId]);

  const toggleDomain = useCallback((domain: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const stats = useMemo(() => {
    const all = new Set<string>();
    for (const r of effectiveRoots) {
      all.add(r);
      for (const id of collectDescendants(index, r, direction, new Set())) {
        all.add(id);
      }
    }
    return { reach: all.size, rootCount: effectiveRoots.length };
  }, [index, effectiveRoots, direction]);

  const isAllMode = rootIds.length === 0 && !cypherActive;
  const cypherMatchSet = cypherActive && cypherResult.ok ? cypherResult.nodeIds : null;

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
          value={rootIds}
          onChange={setRootIds}
          direction={direction}
          onDirectionChange={setDirection}
        />
        <div style={{ flex: 1.2 }}>
          <MustContainPicker
            index={index}
            value={contains}
            onChange={setContains}
          />
          {contains.length > 1 && (
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
                  onClick={() => setContainsAll(k === "all")}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 8px",
                    borderRadius: 3,
                    background:
                      (k === "all") === containsAll ? "#fff" : "transparent",
                    color:
                      (k === "all") === containsAll
                        ? COL.text
                        : COL.textMuted,
                    boxShadow:
                      (k === "all") === containsAll
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
            onClick={() => setAdvancedOpen((v) => !v)}
            title="Cypher query"
            style={{
              border: `0.5px solid ${
                advancedOpen ? COL.accent : COL.border
              }`,
              background: advancedOpen ? COL.accentSoft : "#fff",
              color: advancedOpen ? COL.accentText : COL.textMuted,
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
              fontWeight: advancedOpen ? 600 : 400,
            }}
          >
            Advanced
          </button>
          <button
            type="button"
            onClick={expandAll}
            style={{
              border: `0.5px solid ${COL.border}`,
              background: "#fff",
              color: COL.textMuted,
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
            }}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            style={{
              border: `0.5px solid ${COL.border}`,
              background: "#fff",
              color: COL.textMuted,
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "inherit",
            }}
          >
            Collapse
          </button>
        </div>
      </div>

      {advancedOpen && (
        <CypherQueryBar
          value={cypherQuery}
          onChange={setCypherQuery}
          error={cypherResult.ok ? null : cypherResult.error}
          matchCount={
            cypherResult.ok && cypherResult.nodeIds
              ? cypherResult.nodeIds.size
              : null
          }
          rowCount={
            cypherResult.ok && cypherResult.rowCount !== null
              ? cypherResult.rowCount
              : null
          }
        />
      )}

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
          {direction === "forward" ? "Tracing from" : "Tracing to"}
        </span>
        <span style={{ color: COL.text, fontWeight: 500 }}>
          {cypherActive
            ? `cypher match · ${effectiveRoots.length} node${effectiveRoots.length === 1 ? "" : "s"}`
            : isAllMode
              ? `all events · ${effectiveRoots.length} root${effectiveRoots.length === 1 ? "" : "s"}`
              : `${rootIds.length} event${rootIds.length === 1 ? "" : "s"}`}
        </span>
        <span style={{ color: COL.textFaint }}>·</span>
        <span>
          <span style={{ color: COL.text }}>{stats.reach}</span> nodes{" "}
          {direction === "forward" ? "reachable" : "in upstream cone"}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: COL.textFaint, fontStyle: "italic" }}>
          click any node to inspect · use sidebar to focus as root
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            background: "#fff",
            minWidth: 0,
          }}
        >
          {effectiveRoots.length === 0 && <EmptyState />}
          {groupedRoots.map(({ key, label, rootIds }) => {
            const isCollapsed = collapsedDomains.has(key);
            return (
              <div key={key}>
                <DomainHeader
                  label={label}
                  count={rootIds.length}
                  collapsed={isCollapsed}
                  onToggle={() => toggleDomain(key)}
                />
                {!isCollapsed &&
                  rootIds.map((rid) => (
                    <TreeRow
                      key={rid + "|" + direction}
                      index={index}
                      nodeId={rid}
                      edgeIn={null}
                      direction={direction}
                      depth={0}
                      pathIds={[]}
                      expanded={expanded}
                      setExpanded={setExp}
                      onInspect={(id) => setInspectId(id)}
                      inspectId={inspectId}
                      mustContain={contains}
                      mustContainAll={containsAll}
                      cypherMatch={cypherMatchSet}
                      isRoot
                    />
                  ))}
              </div>
            );
          })}
        </div>
        {inspectId && (
          <InspectorPanel
            index={index}
            nodeId={inspectId}
            onClose={() => setInspectId(null)}
            onMakeRoot={(id, dir) => {
              setDirection(dir);
              setRootIds([id]);
              setExpanded(new Set());
              setInspectId(null);
            }}
            onJump={(id) => setInspectId(id)}
          />
        )}
      </div>
    </div>
  );
}

interface RowProps {
  index: GraphIndex;
  nodeId: string;
  edgeIn: GraphEdge | null;
  direction: "forward" | "reversed";
  depth: number;
  pathIds: string[];
  expanded: Set<string>;
  setExpanded: (key: string, open: boolean) => void;
  onInspect: (id: string) => void;
  inspectId: string | null;
  mustContain: string[];
  mustContainAll: boolean;
  cypherMatch: Set<string> | null;
  isRoot: boolean;
}

function TreeRow({
  index,
  nodeId,
  edgeIn,
  direction,
  depth,
  pathIds,
  expanded,
  setExpanded,
  onInspect,
  inspectId,
  mustContain,
  mustContainAll,
  cypherMatch,
  isRoot,
}: RowProps) {
  const node = index.byId[nodeId];
  if (!node) return null;
  const meta = KIND_META[node.kind];
  const childEdges =
    direction === "forward"
      ? index.outgoing[nodeId] || []
      : index.incoming[nodeId] || [];
  const visited = new Set(pathIds);
  const validChildren = childEdges.filter((e) => {
    const next = direction === "forward" ? e.to : e.from;
    return !visited.has(next);
  });

  const path = pathIds.join("/") + "/" + nodeId;
  const isOpen = expanded.has(path);
  const hasChildren = validChildren.length > 0;

  const branchPasses = isRoot
    ? mustContain.length === 0 ||
      (mustContainAll
        ? mustContain.every((mid) =>
            collectDescendants(index, nodeId, direction, new Set(pathIds)).has(mid),
          )
        : mustContain.some((mid) =>
            collectDescendants(index, nodeId, direction, new Set(pathIds)).has(mid),
          ))
    : true;
  if (!branchPasses) return null;

  const renderableChildren = validChildren.filter((e) => {
    const childId = direction === "forward" ? e.to : e.from;
    if (mustContain.length === 0) return true;
    const desc = collectDescendants(
      index,
      childId,
      direction,
      new Set([...pathIds, nodeId]),
    );
    desc.add(childId);
    return mustContainAll
      ? mustContain.every((mid) => desc.has(mid))
      : mustContain.some((mid) => desc.has(mid));
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          paddingLeft: 12 + depth * 22,
          background: isRoot ? COL.bg : "transparent",
          borderTop: isRoot ? `1px solid ${COL.border}` : "none",
          borderBottom: isRoot && renderableChildren.length > 0 && isOpen
            ? `1px solid ${COL.border}`
            : `0.5px solid oklch(0.96 0.005 80)`,
          position: "relative",
        }}
      >
        {depth > 0 &&
          Array.from({ length: depth }).map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 12 + i * 22 + 9,
                top: 0,
                bottom: 0,
                width: 0,
                borderLeft: `0.5px solid ${COL.border}`,
              }}
            />
          ))}
        {!isRoot && edgeIn && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: FONT_MONO,
              fontSize: 9.5,
              color: COL.textFaint,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              flexShrink: 0,
              transform: "translateX(-4px)",
              width: '14ch',
              justifyContent: 'right',
            }}
          >
            <span>{verbFor(direction, edgeIn.kind)}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded(path, !isOpen)}
          disabled={!hasChildren}
          style={{
            border: "none",
            background: "transparent",
            cursor: hasChildren ? "pointer" : "default",
            color: hasChildren ? COL.textMuted : "transparent",
            width: 16,
            height: 16,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width={9}
            height={9}
            viewBox="0 0 9 9"
            style={{
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform .12s",
            }}
          >
            <path
              d="M2 1 L6 4.5 L2 8"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          onClick={() => onInspect(nodeId)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px 4px 8px",
            borderRadius: 4,
            border: `0.5px solid ${
              inspectId === nodeId
                ? COL.accent
                : isRoot
                  ? COL.accent
                  : COL.borderStrong
            }`,
            background: inspectId === nodeId ? COL.accentSoft : "#fff",
            cursor: "pointer",
            fontSize: 12.5,
            color: COL.text,
            whiteSpace: "nowrap",
            transition: "background 0.08s, border-color 0.08s",
          }}
        >
          <KindGlyph kind={node.kind} />
          <span
            style={{
              fontWeight: isRoot ? 600 : 500,
              color: inspectId === nodeId ? COL.accentText : COL.text,
            }}
          >
            {node.name}
          </span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 9,
              color: COL.textFaint,
              letterSpacing: 0.3,
              textTransform: "uppercase",
              marginLeft: 4,
            }}
          >
            {meta.label}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            flexShrink: 0,
            fontFamily: FONT_MONO,
            fontSize: 10,
            color: COL.textFaint,
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {hasChildren
            ? `${renderableChildren.length} ${direction === "forward" ? "next" : "sources"}`
            : depth === 0
              ? "—"
              : direction === "forward"
                ? "terminal"
                : "origin"}
        </div>
      </div>
      {isOpen &&
        renderableChildren.map((e) => {
          const childId = direction === "forward" ? e.to : e.from;
          return (
            <TreeRow
              key={path + "→" + childId + e.kind}
              index={index}
              nodeId={childId}
              edgeIn={e}
              direction={direction}
              depth={depth + 1}
              pathIds={[...pathIds, nodeId]}
              expanded={expanded}
              setExpanded={setExpanded}
              onInspect={onInspect}
              inspectId={inspectId}
              mustContain={mustContain}
              mustContainAll={mustContainAll}
              cypherMatch={cypherMatch}
              isRoot={false}
            />
          );
        })}
    </div>
  );
}

interface DomainHeaderProps {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

function DomainHeader({ label, count, collapsed, onToggle }: DomainHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "10px 14px 8px",
        border: "none",
        borderTop: `0.5px solid ${COL.border}`,
        background: "#fff",
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      <svg
        width={9}
        height={9}
        viewBox="0 0 9 9"
        style={{
          color: COL.textMuted,
          transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
          transition: "transform .12s",
          flexShrink: 0,
        }}
      >
        <path
          d="M2 1 L6 4.5 L2 8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 11,
          color: COL.text,
          fontWeight: 500,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: COL.textFaint,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        {count} root{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        color: COL.textFaint,
        fontSize: 12,
      }}
    >
      No nodes detected. The parser found no commands, events, sagas, or
      projections in this project.
    </div>
  );
}
