import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  collectDescendants,
  computeDomains,
  type GraphIndex,
  type NodeDomain,
  verbFor,
} from "../lib/graph.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";
import { colorizeName } from "../lib/semantics.js";
import { KindGlyph } from "./KindGlyph.js";
import type { Direction } from "../lib/useFilters.js";
import type { GraphEdge } from "../../shared/types.js";

export interface LinearChainsHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

interface Props {
  index: GraphIndex;
  direction: Direction;
  effectiveRoots: string[];
  contains: string[];
  containsAll: boolean;
  cypherMatch: Set<string> | null;
  inspectId: string | null;
  onInspect: (id: string) => void;
  /** Imperative handle exposing expand/collapse so the FilterBar can call them. */
  registerHandle?: (h: LinearChainsHandle) => void;
  /** True when this view is the currently visible one. */
  isActive: boolean;
}

export function LinearChainsView({
  index,
  direction,
  effectiveRoots,
  contains,
  containsAll,
  cypherMatch,
  inspectId,
  onInspect,
  registerHandle,
  isActive,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(
    () => new Set(),
  );

  const setExp = useCallback((key: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

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

  const expandAll = useCallback(() => {
    const next = new Set<string>();
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
  }, [index, effectiveRoots, direction]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
    const allDomainKeys = new Set<string>();
    for (const r of effectiveRoots) {
      const d = domainByNodeId.get(r);
      if (d) allDomainKeys.add(d.key);
    }
    setCollapsedDomains(allDomainKeys);
  }, [effectiveRoots, domainByNodeId]);

  // Auto-expand on mount and whenever direction flips.
  useLayoutEffect(() => {
    expandAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  // Expose imperative actions for the shared FilterBar's tree-only buttons.
  useLayoutEffect(() => {
    registerHandle?.({ expandAll, collapseAll });
  }, [registerHandle, expandAll, collapseAll]);

  const toggleDomain = useCallback((domain: string) => {
    setCollapsedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Scroll the inspected node into view whenever this view becomes active
  // (initial mount or a switch back to it). The auto-expand effect above
  // commits new DOM, so we retry across a few rAFs until the row exists.
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
        `[data-node-id="${escaped}"]`,
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
    // Only re-fire when the view becomes active; don't auto-scroll on every
    // inspectId change, which would steal focus during normal clicks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <div
      ref={scrollContainerRef}
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
                  domainByNodeId={domainByNodeId}
                  nodeId={rid}
                  edgeIn={null}
                  direction={direction}
                  depth={0}
                  path=""
                  expanded={expanded}
                  setExpanded={setExp}
                  onInspect={onInspect}
                  inspectId={inspectId}
                  mustContain={contains}
                  mustContainAll={containsAll}
                  cypherMatch={cypherMatch}
                  isRoot
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}

interface RowProps {
  index: GraphIndex;
  domainByNodeId: Map<string, NodeDomain>;
  nodeId: string;
  edgeIn: GraphEdge | null;
  direction: Direction;
  depth: number;
  /** Slash-joined ancestor ids (no trailing slash). Stable string keeps
   *  React.memo's shallow compare effective across re-renders. */
  path: string;
  expanded: Set<string>;
  setExpanded: (key: string, open: boolean) => void;
  onInspect: (id: string) => void;
  inspectId: string | null;
  mustContain: string[];
  mustContainAll: boolean;
  cypherMatch: Set<string> | null;
  isRoot: boolean;
}

const TreeRow = memo(function TreeRow({
  index,
  domainByNodeId,
  nodeId,
  edgeIn,
  direction,
  depth,
  path: ancestorPath,
  expanded,
  setExpanded,
  onInspect,
  inspectId,
  mustContain,
  mustContainAll,
  cypherMatch,
  isRoot,
}: RowProps) {
  const pathIds = useMemo<string[]>(
    () => (ancestorPath === "" ? [] : ancestorPath.split("/")),
    [ancestorPath],
  );
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
        data-node-id={nodeId}
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
            {colorizeName(node.name, domainByNodeId.get(nodeId))}
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
          {cypherMatch?.has(nodeId) && (
            <span
              title="Matched by Cypher query"
              style={{
                fontFamily: FONT_MONO,
                fontSize: 8.5,
                color: COL.accentText,
                background: COL.accentSoft,
                padding: "1px 5px",
                borderRadius: 3,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                marginLeft: 2,
              }}
            >
              match
            </span>
          )}
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
              domainByNodeId={domainByNodeId}
              nodeId={childId}
              edgeIn={e}
              direction={direction}
              depth={depth + 1}
              path={ancestorPath === "" ? nodeId : ancestorPath + "/" + nodeId}
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
});

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
