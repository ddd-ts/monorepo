import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import type { GraphIndex } from "../lib/graph.js";
import { computeVisibleSubgraph } from "../lib/subgraph.js";
import type { Direction } from "../lib/useFilters.js";
import type { NodeKind } from "../../shared/types.js";
import { COL, FONT_MONO, KIND_META } from "../lib/tokens.js";

// Mermaid's `classDef` parser does NOT accept parenthesised CSS color
// functions like oklch(...) / rgb(...) / hsl(...) — it splits on `(`/`)`. We
// keep a parallel hex palette here that approximates the OKLCH tokens
// used in the rest of the app.
const KIND_FILL_HEX: Record<NodeKind, string> = {
  event: "#eff1fa",
  command: "#f5f3ec",
  effect: "#f8f0eb",
  saga: "#eff5ed",
  projection: "#eef4f6",
  policy: "#f6eef3",
};
const STROKE_HEX = "#c5c2bc";
const STROKE_SELECTED_HEX = "#3e6dc4";
const TEXT_HEX = "#36352f";

// One global click bridge that mermaid's `click NODE callback` directive
// resolves at runtime (with securityLevel: 'loose' it looks up
// `window[callback]`). We store the latest GraphView's handler here and let
// re-renders overwrite it; only one GraphView is mounted at a time.
declare global {
  interface Window {
    __eventvizMermaidClick?: (sid: string) => void;
  }
}

// Inject hover/focus/selected styling once.
// - Hover/focus target `g.node` (pure CSS, no JS dependency — works as long
//   as mermaid puts class="node" on each rendered node, which it has done
//   from v9 through v11).
// - Selection targets `.eventviz-selected`, a class we toggle from
//   `markSelected` after finding the node group via idMap. This decouples
//   selection from any attribute we may or may not be able to attach.
// - !important guards against any inline stroke mermaid's classDef emits.
const STYLE_ID = "__eventviz_graph_styles";
function ensureGraphStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    .eventviz-graph svg { user-select: none; }
    .eventviz-graph g.node { cursor: pointer; outline: none; }
    .eventviz-graph g.node rect,
    .eventviz-graph g.node polygon,
    .eventviz-graph g.node circle {
      transition: stroke 0.08s linear, stroke-width 0.08s linear, filter 0.08s linear;
    }
    .eventviz-graph g.node:hover rect,
    .eventviz-graph g.node:hover polygon,
    .eventviz-graph g.node:hover circle {
      stroke: ${STROKE_SELECTED_HEX} !important;
      stroke-width: 1.5 !important;
      filter: drop-shadow(0 1px 4px rgba(62, 109, 196, 0.18));
    }
    .eventviz-graph g.node:focus-visible rect,
    .eventviz-graph g.node:focus-visible polygon,
    .eventviz-graph g.node:focus-visible circle {
      stroke: ${STROKE_SELECTED_HEX} !important;
      stroke-width: 2.5 !important;
    }
    .eventviz-graph .eventviz-selected rect,
    .eventviz-graph .eventviz-selected polygon,
    .eventviz-graph .eventviz-selected circle {
      stroke: ${STROKE_SELECTED_HEX} !important;
      stroke-width: 2.5 !important;
      filter: drop-shadow(0 2px 6px rgba(62, 109, 196, 0.22));
    }
  `;
  document.head.appendChild(s);
}
ensureGraphStyles();

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  securityLevel: "loose",
  // Default caps (50_000 chars / 500 edges) trip "Maximum text size in
  // diagram exceeded" on real-world graphs. Bump to comfortably handle
  // monorepo-scale event graphs.
  maxTextSize: 5_000_000,
  maxEdges: 10_000,
  flowchart: {
    htmlLabels: true,
    curve: "basis",
    // Render at intrinsic size so labels stay readable; the parent <div>
    // handles overflow + zoom.
    useMaxWidth: false,
    nodeSpacing: 32,
    rankSpacing: 60,
  },
  themeVariables: {
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: "14px",
  },
});

interface Props {
  index: GraphIndex;
  direction: Direction;
  effectiveRoots: string[];
  contains: string[];
  containsAll: boolean;
  cypherMatch: Set<string> | null;
  inspectId: string | null;
  onInspect: (id: string | null) => void;
  isActive: boolean;
}

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

export function GraphView({
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
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const { nodes, edges, source, idMap } = useMemo(() => {
    const sub = computeVisibleSubgraph({
      index,
      roots: effectiveRoots,
      direction,
      mustContain: contains,
      mustContainAll: containsAll,
    });
    const { source: src, idMap: m } = buildMermaid(
      sub.nodes,
      sub.edges,
      direction,
      index,
      cypherMatch,
    );
    return { nodes: sub.nodes, edges: sub.edges, source: src, idMap: m };
  }, [index, effectiveRoots, direction, contains, containsAll, cypherMatch]);

  // Latest onInspect kept in a ref so we don't re-render Mermaid each time
  // the parent re-creates the function (every state change in App).
  const onInspectRef = useRef(onInspect);
  useEffect(() => {
    onInspectRef.current = onInspect;
  }, [onInspect]);

  // Latest inspectId used inside the async render's .then() so the new SVG
  // gets its .selected class re-applied without depending on a separate
  // useEffect firing after the (asynchronous) mermaid render completes.
  const inspectIdRef = useRef(inspectId);
  useEffect(() => {
    inspectIdRef.current = inspectId;
  }, [inspectId]);

  // Register the global click bridge for mermaid's `click NODE callback`
  // directive. We resolve sid → original node id via idMap.
  useEffect(() => {
    window.__eventvizMermaidClick = (sid: string) => {
      const original = idMap.get(sid);
      if (original) onInspectRef.current(original);
    };
    return () => {
      delete window.__eventvizMermaidClick;
    };
  }, [idMap]);

  useEffect(() => {
    let cancelled = false;
    if (!svgWrapRef.current) return;
    if (nodes.size === 0) {
      svgWrapRef.current.innerHTML = "";
      return;
    }
    setError(null);
    const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(renderId, source)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || !svgWrapRef.current) return;
        svgWrapRef.current.innerHTML = svg;
        bindFunctions?.(svgWrapRef.current);
        // Belt-and-suspenders: also attach our own listener in case the
        // current mermaid build doesn't wire `click` directives the way we
        // expect.
        attachFallbackClicks(svgWrapRef.current, idMap, (id) =>
          onInspectRef.current(id),
        );
        // Re-apply the persistent .selected class on the freshly-rendered
        // SVG. The dedicated `inspectId` useEffect below races mermaid's
        // async render and would otherwise mark nodes that don't exist yet.
        markSelected(svgWrapRef.current, idMap, index, inspectIdRef.current);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [source, idMap, nodes.size]);

  // Re-mark the selected node without re-rendering the SVG.
  useEffect(() => {
    if (!svgWrapRef.current) return;
    markSelected(svgWrapRef.current, idMap, index, inspectId);
  }, [inspectId, idMap, index]);

  // When the view becomes active (initial mount or switched to), scroll the
  // selected node into view. The mermaid render is async, so we may need to
  // wait a frame or two.
  useEffect(() => {
    if (!isActive || !inspectId) return;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const wrap = svgWrapRef.current;
      const scroll = scrollRef.current;
      if (wrap && scroll && wrap.querySelector("svg")) {
        scrollGraphToInspectId(wrap, scroll, idMap, inspectId);
        return;
      }
      if (attempts++ < 30) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const fit = useCallback(() => {
    if (!svgWrapRef.current || !scrollRef.current) return;
    const svg = svgWrapRef.current.querySelector("svg");
    if (!svg) return;
    const bbox = svg.getBoundingClientRect();
    const container = scrollRef.current.getBoundingClientRect();
    if (bbox.width === 0 || bbox.height === 0) return;
    const z = Math.min(
      (container.width - 32) / (bbox.width / zoom),
      (container.height - 32) / (bbox.height / zoom),
      ZOOM_MAX,
    );
    setZoom(Math.max(ZOOM_MIN, z));
  }, [zoom]);

  // Trackpad pinch + Ctrl-scroll zoom, pinned under the cursor. macOS pinch
  // gestures fire as wheel events with `ctrlKey: true`. React's onWheel is
  // passive, so we attach a native listener with { passive: false } to be
  // able to call preventDefault and avoid the page-level zoom.
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const wrap = svgWrapRef.current;
    if (!scroll || !wrap) return;
    const PAD = 20; // matches the scroll container's padding
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // let normal scroll/pan pass through
      e.preventDefault();
      const oldZoom = zoomRef.current;
      const factor = Math.exp(-e.deltaY * 0.01);
      const newZoom = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, +(oldZoom * factor).toFixed(4)),
      );
      if (newZoom === oldZoom) return;
      const rect = scroll.getBoundingClientRect();
      const visibleX = e.clientX - rect.left;
      const visibleY = e.clientY - rect.top;
      const newScrollLeft =
        ((visibleX + scroll.scrollLeft - PAD) * newZoom) / oldZoom +
        PAD -
        visibleX;
      const newScrollTop =
        ((visibleY + scroll.scrollTop - PAD) * newZoom) / oldZoom +
        PAD -
        visibleY;
      // Mutate transform synchronously so the scroll adjustment lands on the
      // new content size (React will reconcile this same value on the next
      // commit; no flicker).
      wrap.style.transform = `scale(${newZoom})`;
      scroll.scrollLeft = newScrollLeft;
      scroll.scrollTop = newScrollTop;
      zoomRef.current = newZoom;
      setZoom(newZoom);
    };
    scroll.addEventListener("wheel", onWheel, { passive: false });
    return () => scroll.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "auto",
        background: "#fff",
        padding: "20px",
        position: "relative",
      }}
    >
      <ZoomControls
        zoom={zoom}
        onIn={() =>
          setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(3)))
        }
        onOut={() =>
          setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(3)))
        }
        onReset={() => setZoom(1)}
        onFit={fit}
      />
      {nodes.size === 0 && <EmptyState />}
      {error && (
        <div
          style={{
            padding: 12,
            color: "oklch(0.5 0.18 25)",
            fontFamily: FONT_MONO,
            fontSize: 12,
          }}
        >
          ✗ mermaid: {error}
        </div>
      )}
      <div
        ref={svgWrapRef}
        className="eventviz-graph"
        onClick={(e) => {
          // Click on a node bubbles through here too — let the node's own
          // handler win and skip deselection.
          const target = e.target as HTMLElement;
          if (target.closest("g.node")) return;
          onInspectRef.current(null);
        }}
        style={{
          fontFamily: FONT_MONO,
          transform: `scale(${zoom})`,
          transformOrigin: "top left",
          // Reserve roughly the post-scale footprint so the parent's
          // scrollbar tracks the actually-visible content.
          width: "fit-content",
        }}
      />
      <div
        style={{
          marginTop: 12,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          color: COL.textFaint,
          letterSpacing: 0.3,
        }}
      >
        {nodes.size} node{nodes.size === 1 ? "" : "s"} · {edges.length} edge
        {edges.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

interface ZoomControlsProps {
  zoom: number;
  onIn: () => void;
  onOut: () => void;
  onReset: () => void;
  onFit: () => void;
}

function ZoomControls({ zoom, onIn, onOut, onReset, onFit }: ZoomControlsProps) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        marginBottom: 8,
        zIndex: 5,
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(4px)",
        border: `0.5px solid ${COL.border}`,
        borderRadius: 4,
        alignSelf: "flex-start",
      }}
    >
      <ZoomBtn onClick={onOut} label="−" title="Zoom out" />
      <button
        type="button"
        onClick={onReset}
        title="Reset zoom"
        style={{
          border: "none",
          background: "transparent",
          color: COL.textMuted,
          fontFamily: FONT_MONO,
          fontSize: 10.5,
          letterSpacing: 0.3,
          padding: "4px 8px",
          minWidth: 48,
          cursor: "pointer",
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <ZoomBtn onClick={onIn} label="+" title="Zoom in" />
      <div style={{ width: 1, background: COL.border, margin: "2px 4px" }} />
      <button
        type="button"
        onClick={onFit}
        title="Fit graph to view"
        style={{
          border: "none",
          background: "transparent",
          color: COL.textMuted,
          fontFamily: "inherit",
          fontSize: 10.5,
          padding: "4px 10px",
          cursor: "pointer",
          letterSpacing: 0.2,
        }}
      >
        Fit
      </button>
    </div>
  );
}

function ZoomBtn({
  onClick,
  label,
  title,
}: {
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        border: "none",
        background: "transparent",
        color: COL.textMuted,
        fontFamily: FONT_MONO,
        fontSize: 14,
        lineHeight: 1,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function sanitize(id: string): string {
  return "n" + id.replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeLabel(s: string): string {
  // Mermaid quoted node labels: " is not allowed; replace with #34;
  return s.replace(/"/g, "#quot;");
}

function buildMermaid(
  nodes: Set<string>,
  edges: { from: string; to: string; kind: string }[],
  direction: Direction,
  index: GraphIndex,
  cypherMatch: Set<string> | null,
): { source: string; idMap: Map<string, string> } {
  const lines: string[] = [`flowchart LR`];
  const idMap = new Map<string, string>(); // sanitized → original

  for (const id of nodes) {
    const node = index.byId[id];
    if (!node) continue;
    const sid = sanitize(id);
    idMap.set(sid, id);
    const nameLine = escapeLabel(node.name);
    const meta = KIND_META[node.kind].label;
    const subLine = cypherMatch?.has(id) ? `${meta} · MATCH` : meta;
    lines.push(
      `  ${sid}["${nameLine}<br/><span class='m-kind'>${escapeLabel(subLine)}</span>"]:::k_${node.kind}`,
    );
    // Mermaid's official click directive — resolves to window[callback] when
    // securityLevel='loose'. The sid is passed as the first argument.
    lines.push(`  click ${sid} __eventvizMermaidClick`);
  }

  for (const e of edges) {
    const from = sanitize(direction === "forward" ? e.from : e.to);
    const to = sanitize(direction === "forward" ? e.to : e.from);
    if (!idMap.has(from) || !idMap.has(to)) continue;
    lines.push(`  ${from} -->|${e.kind}| ${to}`);
  }

  // Per-kind classDef. Use plain hex — mermaid's classDef parser breaks on
  // function-style colors (oklch/rgb/hsl).
  const kindStyle = (bg: string) =>
    `fill:${bg},stroke:${STROKE_HEX},stroke-width:0.5px,color:${TEXT_HEX},rx:6,ry:6`;
  for (const k of Object.keys(KIND_FILL_HEX) as NodeKind[]) {
    lines.push(`  classDef k_${k} ${kindStyle(KIND_FILL_HEX[k])}`);
  }

  return { source: lines.join("\n"), idMap };
}

function attachFallbackClicks(
  container: HTMLElement,
  idMap: Map<string, string>,
  onInspect: (id: string) => void,
) {
  // Iterate idMap and locate each node's <g> by sid. We don't rely on the
  // DOM-tree shape — different mermaid versions wrap nodes differently. Sids
  // are sanitized to [A-Za-z0-9_], so they're safe to interpolate into
  // attribute selectors without escaping.
  for (const [sid, original] of idMap) {
    const g = findNodeGroup(container, sid);
    if (!g) continue;
    if (g.getAttribute("data-eventviz-id") === original) continue; // already wired
    g.setAttribute("data-eventviz-id", original);
    g.setAttribute("tabindex", "0");
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      onInspect(original);
    });
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onInspect(original);
      }
    });
  }
}

function scrollGraphToInspectId(
  wrap: HTMLElement | null,
  scroll: HTMLElement | null,
  idMap: Map<string, string>,
  inspectId: string,
) {
  if (!wrap || !scroll) return;
  let targetSid: string | null = null;
  for (const [sid, original] of idMap) {
    if (original === inspectId) {
      targetSid = sid;
      break;
    }
  }
  if (!targetSid) return;
  const g = findNodeGroup(wrap, targetSid);
  if (!g) return;
  const nodeBox = g.getBoundingClientRect();
  const scrollBox = scroll.getBoundingClientRect();
  if (nodeBox.width === 0 && nodeBox.height === 0) return;
  // Center the node inside the scroll viewport.
  const dx =
    nodeBox.left + nodeBox.width / 2 - scrollBox.left - scrollBox.width / 2;
  const dy =
    nodeBox.top + nodeBox.height / 2 - scrollBox.top - scrollBox.height / 2;
  scroll.scrollLeft += dx;
  scroll.scrollTop += dy;
}

function findNodeGroup(
  container: HTMLElement,
  sid: string,
): SVGGElement | null {
  // Mermaid v11 produces ids like `mermaid-<svgRandomId>-flowchart-<sid>-<idx>`,
  // not just `flowchart-<sid>-<idx>` as in older versions. Cover both shapes.
  const tries = [
    `g[data-id="${sid}"]`,
    `g[data-id="flowchart-${sid}"]`,
    `g[id*="-flowchart-${sid}-"]`,
    `g[id^="flowchart-${sid}-"]`,
    `g[id="flowchart-${sid}"]`,
    `g[id="${sid}"]`,
    `g[id^="${sid}-"]`,
    `g.${sid}`,
  ];
  for (const sel of tries) {
    try {
      const el = container.querySelector<SVGGElement>(sel);
      if (el) return el;
    } catch {
      // selector might be invalid for some sid shapes; ignore and continue
    }
  }
  // Last resort: walk every g[id] and try to parse out the sid.
  const all = container.querySelectorAll<SVGGElement>("g[id]");
  for (const el of all) {
    const id = el.id;
    if (!id) continue;
    const m = id.match(/(?:^|-)flowchart-(.+?)-\d+$/);
    if (m && m[1] === sid) return el;
  }
  return null;
}

function markSelected(
  container: HTMLElement,
  idMap: Map<string, string>,
  index: GraphIndex,
  inspectId: string | null,
) {
  // Reset every previously-selected shape (we tag the affected <g> so we
  // know which to clean up).
  container
    .querySelectorAll<SVGGElement>("[data-eventviz-selected='1']")
    .forEach((g) => {
      g.removeAttribute("data-eventviz-selected");
      paintShapes(g, null);
    });
  applyDimming(container, idMap, index, inspectId);
  if (!inspectId) return;
  // Reverse-lookup the sanitized id, then find that node's <g>.
  let targetSid: string | null = null;
  for (const [sid, original] of idMap) {
    if (original === inspectId) {
      targetSid = sid;
      break;
    }
  }
  if (!targetSid) return;
  const g = findNodeGroup(container, targetSid);
  if (!g) return;
  g.setAttribute("data-eventviz-selected", "1");
  paintShapes(g, "selected");
}

/**
 * Compute the connected component of `inspectId` in the full graph (BFS in
 * both directions, treating edges as undirected) and lower opacity on every
 * <g.node> and edge <path> that's NOT in that set. Restores when inspectId
 * is null.
 */
function applyDimming(
  container: HTMLElement,
  idMap: Map<string, string>,
  index: GraphIndex,
  inspectId: string | null,
) {
  // Always start by clearing previous dimming.
  container
    .querySelectorAll<SVGElement>("[data-evv-dimmed='1']")
    .forEach((el) => {
      el.style.removeProperty("opacity");
      el.removeAttribute("data-evv-dimmed");
    });
  if (!inspectId) return;

  // Two unidirectional BFS so siblings via a shared parent don't sneak in.
  // - Upstream: only follow incoming edges (collects ancestors).
  // - Downstream: only follow outgoing edges (collects descendants).
  const related = new Set<string>([inspectId]);
  const upQueue: string[] = [inspectId];
  while (upQueue.length) {
    const id = upQueue.shift() as string;
    for (const e of index.incoming[id] ?? []) {
      if (!related.has(e.from)) {
        related.add(e.from);
        upQueue.push(e.from);
      }
    }
  }
  const downQueue: string[] = [inspectId];
  while (downQueue.length) {
    const id = downQueue.shift() as string;
    for (const e of index.outgoing[id] ?? []) {
      if (!related.has(e.to)) {
        related.add(e.to);
        downQueue.push(e.to);
      }
    }
  }

  // Project related originals → sanitized ids, plus the full sid universe.
  const relatedSids = new Set<string>();
  const allSids = new Set<string>();
  for (const [sid, original] of idMap) {
    allSids.add(sid);
    if (related.has(original)) relatedSids.add(sid);
  }

  const dim = (el: SVGElement) => {
    el.style.setProperty("opacity", "0.15", "important");
    el.setAttribute("data-evv-dimmed", "1");
  };

  // --- Nodes ---
  container.querySelectorAll<SVGGElement>("g.node").forEach((g) => {
    const m = g.id.match(/(?:^|-)flowchart-(.+?)-\d+$/);
    const sid = m ? m[1] : null;
    if (!sid) return;
    if (!relatedSids.has(sid)) dim(g);
  });

  // --- Edges ---
  // Mermaid v11 ids: `L_<source-sid>_<target-sid>_<idx>`. Both sids may
  // contain underscores, so we can't naively split — we try every known sid
  // as the source prefix and verify the remainder is also a sid.
  container
    .querySelectorAll<SVGElement>("path[data-edge='true'], path.flowchart-link")
    .forEach((p) => {
      const dataId = p.getAttribute("data-id") ?? "";
      if (!dataId.startsWith("L_")) return;
      const rest = dataId.slice(2);
      let source: string | null = null;
      let target: string | null = null;
      for (const sid of allSids) {
        if (rest.startsWith(sid + "_")) {
          const after = rest.slice(sid.length + 1);
          const m = after.match(/^(.+)_(\d+)$/);
          if (m && allSids.has(m[1])) {
            source = sid;
            target = m[1];
            break;
          }
        }
      }
      if (!source || !target) return;
      if (!relatedSids.has(source) || !relatedSids.has(target)) dim(p);
    });
}

/**
 * Apply or clear inline selection styling on every shape (rect/polygon/circle)
 * inside the node group. Mermaid v11's classDef emits inline `style="...
 * !important"` on each rect, so we MUST go through setProperty(name, value,
 * "important") to win the cascade — plain `style.stroke = ...` (no priority)
 * is beaten by mermaid's existing !important declaration.
 *
 * We snapshot the original `style` attribute on first paint and restore it
 * verbatim when deselecting, so mermaid's per-kind classDef colours come back.
 */
function paintShapes(g: SVGGElement, mode: "selected" | null) {
  const shapes = g.querySelectorAll<SVGElement>("rect, polygon, circle");
  shapes.forEach((shape) => {
    const el = shape as SVGElement & {
      dataset: DOMStringMap;
      style: CSSStyleDeclaration;
    };
    if (mode === "selected") {
      if (el.dataset.evvOriginalStyle === undefined) {
        el.dataset.evvOriginalStyle = el.getAttribute("style") ?? "";
      }
      el.style.setProperty("stroke", STROKE_SELECTED_HEX, "important");
      el.style.setProperty("stroke-width", "2.5px", "important");
      el.style.setProperty(
        "filter",
        "drop-shadow(0 2px 6px rgba(62, 109, 196, 0.22))",
        "important",
      );
    } else if (el.dataset.evvOriginalStyle !== undefined) {
      // Restore mermaid's original inline style verbatim.
      const orig = el.dataset.evvOriginalStyle;
      if (orig) el.setAttribute("style", orig);
      else el.removeAttribute("style");
      delete el.dataset.evvOriginalStyle;
    }
  });
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
      No nodes match the current filter.
    </div>
  );
}
