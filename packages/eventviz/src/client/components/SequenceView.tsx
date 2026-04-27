import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GraphEdge,
  GraphNode,
  NodeKind,
} from "../../shared/types.js";
import { chainFrom, type GraphIndex } from "../lib/graph.js";
import { COL, FONT_MONO, KIND_BG, KIND_META } from "../lib/tokens.js";
import { KindGlyph } from "./KindGlyph.js";

type LayoutKind = "sequence" | "hierarchical" | "force" | "radial";

interface Layout {
  positions: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
  colKeys?: number[];
}

interface Props {
  index: GraphIndex;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  search: string;
  layout: LayoutKind;
}

const KIND_ORDER: NodeKind[] = [
  "command",
  "saga",
  "effect",
  "event",
  "policy",
  "projection",
];

function layoutSequence(nodes: GraphNode[], edges: GraphEdge[]): Layout {
  const inDeg: Record<string, number> = {};
  const outAdj: Record<string, string[]> = {};
  for (const n of nodes) {
    inDeg[n.id] = 0;
    outAdj[n.id] = [];
  }
  for (const e of edges) {
    inDeg[e.to] = (inDeg[e.to] || 0) + 1;
    if (outAdj[e.from]) outAdj[e.from].push(e.to);
  }
  const col: Record<string, number> = {};
  const queue: string[] = nodes
    .filter((n) => inDeg[n.id] === 0)
    .map((n) => n.id);
  for (const id of queue) col[id] = 0;
  const visits: Record<string, number> = {};
  while (queue.length) {
    const id = queue.shift()!;
    visits[id] = (visits[id] || 0) + 1;
    if (visits[id] > 4) continue;
    for (const to of outAdj[id] || []) {
      const next = (col[id] ?? 0) + 1;
      if (col[to] == null || next > col[to]) {
        col[to] = next;
        queue.push(to);
      }
    }
  }
  for (const n of nodes) if (col[n.id] == null) col[n.id] = 0;

  const cols: Record<number, GraphNode[]> = {};
  for (const n of nodes) {
    const k = col[n.id];
    (cols[k] ||= []).push(n);
  }
  for (const k of Object.keys(cols)) {
    cols[Number(k)].sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a.kind);
      const bi = KIND_ORDER.indexOf(b.kind);
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }

  const COL_W = 220;
  const ROW_H = 44;
  const pad = 40;
  const positions: Record<string, { x: number; y: number }> = {};
  const colKeys = Object.keys(cols)
    .map(Number)
    .sort((a, b) => a - b);
  let height = 0;
  for (const c of colKeys) {
    cols[c].forEach((n, i) => {
      positions[n.id] = { x: pad + c * COL_W, y: pad + i * ROW_H };
      height = Math.max(height, pad + i * ROW_H + ROW_H);
    });
  }
  const width = pad + ((colKeys[colKeys.length - 1] ?? 0) + 1) * COL_W + pad;
  return { positions, width, height: height + pad, colKeys };
}

function layoutHierarchical(nodes: GraphNode[], edges: GraphEdge[]): Layout {
  const inAdj: Record<string, string[]> = {};
  for (const n of nodes) inAdj[n.id] = [];
  for (const e of edges) inAdj[e.to]?.push(e.from);
  const level: Record<string, number> = {};
  const compute = (id: string, seen = new Set<string>()): number => {
    if (level[id] != null) return level[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    if ((inAdj[id] || []).length === 0) {
      level[id] = 0;
      return 0;
    }
    let m = 0;
    for (const p of inAdj[id]) m = Math.max(m, compute(p, seen) + 1);
    level[id] = m;
    return m;
  };
  for (const n of nodes) compute(n.id);
  const levels: Record<number, GraphNode[]> = {};
  for (const n of nodes) (levels[level[n.id]] ||= []).push(n);
  const ROW_H = 130;
  const COL_W = 200;
  const positions: Record<string, { x: number; y: number }> = {};
  const lvlKeys = Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b);
  const maxRow = Math.max(...lvlKeys.map((l) => levels[l].length), 1);
  for (const l of lvlKeys) {
    const arr = levels[l];
    arr.sort((a, b) =>
      a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    );
    arr.forEach((n, i) => {
      const offset = (maxRow - arr.length) / 2;
      positions[n.id] = {
        x: 60 + i * COL_W + offset * COL_W,
        y: 60 + l * ROW_H,
      };
    });
  }
  return {
    positions,
    width: 60 + maxRow * COL_W + 60,
    height: 60 + lvlKeys.length * ROW_H + 60,
  };
}

function layoutForce(nodes: GraphNode[], edges: GraphEdge[]): Layout {
  const W = 1600;
  const H = 1100;
  const pos: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    let h = 0;
    for (let i = 0; i < n.id.length; i++) h = (h * 31 + n.id.charCodeAt(i)) | 0;
    pos[n.id] = {
      x: W / 2 + ((h & 1023) - 512),
      y: H / 2 + (((h >> 10) & 1023) - 512),
    };
  }
  const k = 110;
  const repulsion = 12000;
  const ITERS = 200;
  for (let iter = 0; iter < ITERS; iter++) {
    const cool = 1 - iter / ITERS;
    const force: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) force[n.id] = { x: 0, y: 0 };
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].id;
        const b = nodes[j].id;
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const d2 = dx * dx + dy * dy + 0.01;
        const d = Math.sqrt(d2);
        const f = repulsion / d2;
        force[a].x += (dx / d) * f;
        force[a].y += (dy / d) * f;
        force[b].x -= (dx / d) * f;
        force[b].y -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = pos[e.from];
      const b = pos[e.to];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const f = (d * d) / k;
      force[e.from].x += (dx / d) * f * 0.5;
      force[e.from].y += (dy / d) * f * 0.5;
      force[e.to].x -= (dx / d) * f * 0.5;
      force[e.to].y -= (dy / d) * f * 0.5;
    }
    for (const n of nodes) {
      const f = force[n.id];
      const mag = Math.min(40, Math.sqrt(f.x * f.x + f.y * f.y));
      const dir = Math.atan2(f.y, f.x);
      pos[n.id].x += Math.cos(dir) * mag * cool;
      pos[n.id].y += Math.sin(dir) * mag * cool;
    }
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, pos[n.id].x);
    minY = Math.min(minY, pos[n.id].y);
    maxX = Math.max(maxX, pos[n.id].x);
    maxY = Math.max(maxY, pos[n.id].y);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    positions[n.id] = { x: pos[n.id].x - minX + 60, y: pos[n.id].y - minY + 60 };
  }
  return {
    positions,
    width: maxX - minX + 120,
    height: maxY - minY + 120,
  };
}

function layoutRadial(nodes: GraphNode[], edges: GraphEdge[]): Layout {
  const inAdj: Record<string, string[]> = {};
  const outAdj: Record<string, string[]> = {};
  for (const n of nodes) {
    inAdj[n.id] = [];
    outAdj[n.id] = [];
  }
  for (const e of edges) {
    outAdj[e.from]?.push(e.to);
    inAdj[e.to]?.push(e.from);
  }
  const depth: Record<string, number> = {};
  const sources = nodes
    .filter((n) => (inAdj[n.id] || []).length === 0)
    .map((n) => n.id);
  const queue: { id: string; d: number }[] = sources.map((id) => ({
    id,
    d: 0,
  }));
  for (const id of sources) depth[id] = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    for (const to of outAdj[cur.id] || []) {
      if (depth[to] == null || cur.d + 1 < depth[to]) {
        depth[to] = cur.d + 1;
        queue.push({ id: to, d: cur.d + 1 });
      }
    }
  }
  for (const n of nodes) if (depth[n.id] == null) depth[n.id] = 0;
  const rings: Record<number, GraphNode[]> = {};
  for (const n of nodes) (rings[depth[n.id]] ||= []).push(n);
  const positions: Record<string, { x: number; y: number }> = {};
  const cx = 700;
  const cy = 700;
  const ringKeys = Object.keys(rings)
    .map(Number)
    .sort((a, b) => a - b);
  for (const r of ringKeys) {
    const arr = rings[r];
    arr.sort((a, b) =>
      a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    );
    const radius = r === 0 ? 0 : 130 + r * 150;
    arr.forEach((n, i) => {
      if (r === 0 && arr.length === 1) {
        positions[n.id] = { x: cx, y: cy };
      } else if (r === 0) {
        const a = (i / arr.length) * Math.PI * 2;
        positions[n.id] = {
          x: cx + Math.cos(a) * 80,
          y: cy + Math.sin(a) * 80,
        };
      } else {
        const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
        positions[n.id] = {
          x: cx + Math.cos(a) * radius,
          y: cy + Math.sin(a) * radius,
        };
      }
    });
  }
  return { positions, width: cx * 2, height: cy * 2 };
}

const LAYOUTS: Record<
  LayoutKind,
  (nodes: GraphNode[], edges: GraphEdge[]) => Layout
> = {
  sequence: layoutSequence,
  hierarchical: layoutHierarchical,
  force: layoutForce,
  radial: layoutRadial,
};

const NODE_W = 196;
const NODE_H = 40;

export function SequenceView({
  index,
  selectedId,
  onSelect,
  search,
  layout,
}: Props) {
  const computed = useMemo(
    () => LAYOUTS[layout](index.nodes, index.edges),
    [layout, index],
  );
  const { positions, width, height } = computed;

  const chain = useMemo(
    () => (selectedId ? chainFrom(index, selectedId, "both") : null),
    [selectedId, index],
  );
  const inChainNode = (id: string) => chain?.nodes.has(id) ?? false;
  const inChainEdge = (e: GraphEdge) =>
    chain?.edges.has(`${e.from}→${e.to}`) ?? false;

  const matchesSearch = (n: GraphNode) =>
    !search ||
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.id.toLowerCase().includes(search.toLowerCase());

  const dimNode = (n: GraphNode) =>
    (selectedId && !inChainNode(n.id)) || (search ? !matchesSearch(n) : false);
  const dimEdge = (e: GraphEdge) => {
    const from = index.byId[e.from];
    const to = index.byId[e.to];
    return (
      (selectedId && !inChainEdge(e)) ||
      (search ? !matchesSearch(from) || !matchesSearch(to) : false)
    );
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const tfRef = useRef(view);
  tfRef.current = view;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = tfRef.current;
      if (
        e.ctrlKey ||
        (e.deltaY !== 0 &&
          e.deltaX === 0 &&
          Number.isInteger(e.deltaY) &&
          Math.abs(e.deltaY) >= 40)
      ) {
        const r = el.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const next = Math.max(
          0.2,
          Math.min(3, t.scale * Math.exp(-e.deltaY * 0.005)),
        );
        const k = next / t.scale;
        setView({
          x: px - (px - t.x) * k,
          y: py - (py - t.y) * k,
          scale: next,
        });
      } else {
        setView({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY });
      }
    };
    let drag: { x: number; y: number; sx: number; sy: number } | null = null;
    const onPd = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-node-card]")) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        sx: tfRef.current.x,
        sy: tfRef.current.y,
      };
      el.style.cursor = "grabbing";
    };
    const onPm = (e: PointerEvent) => {
      if (!drag) return;
      setView((v) => ({
        ...v,
        x: drag!.sx + (e.clientX - drag!.x),
        y: drag!.sy + (e.clientY - drag!.y),
      }));
    };
    const onPu = () => {
      drag = null;
      el.style.cursor = "";
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPd);
    window.addEventListener("pointermove", onPm);
    window.addEventListener("pointerup", onPu);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPd);
      window.removeEventListener("pointermove", onPm);
      window.removeEventListener("pointerup", onPu);
    };
  }, []);

  // Auto-fit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 40;
    const sx = (r.width - pad * 2) / Math.max(width, 1);
    const sy = (r.height - pad * 2) / Math.max(height, 1);
    const s = Math.min(sx, sy, 1);
    setView({
      x: pad + (r.width - width * s - pad * 2) / 2,
      y: pad,
      scale: s,
    });
  }, [layout, width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: COL.bg,
        overflow: "hidden",
        cursor: "grab",
        userSelect: "none",
      }}
      onClick={() => onSelect(null)}
    >
      {layout === "sequence" && computed.colKeys && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            background:
              "linear-gradient(to bottom, rgba(251,250,248,0.95), rgba(251,250,248,0))",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <svg
            width={width * view.scale}
            height={28}
            style={{ transform: `translate(${view.x}px, 0)` }}
          >
            {computed.colKeys.map((c) => {
              const x = (40 + c * 220) * view.scale + 16 * view.scale;
              return (
                <text
                  key={c}
                  x={x}
                  y={18}
                  fontFamily={FONT_MONO}
                  fontSize={9.5}
                  letterSpacing={0.6}
                  fill={COL.textFaint}
                  style={{ textTransform: "uppercase" }}
                >
                  Step {c + 1}
                </text>
              );
            })}
          </svg>
        </div>
      )}

      <svg
        width={width}
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COL.edgeIdle} />
          </marker>
          <marker
            id="arrow-chain"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COL.edgeChain} />
          </marker>
        </defs>

        <g>
          {index.edges.map((e, i) => (
            <Edge
              key={i}
              edge={e}
              positions={positions}
              layout={layout}
              inChain={inChainEdge(e)}
              dimmed={!!dimEdge(e)}
            />
          ))}
        </g>

        <g>
          {index.nodes.map((n) => {
            const p = positions[n.id];
            if (!p) return null;
            return (
              <g key={n.id} data-node-card>
                <NodeCard
                  node={n}
                  x={p.x}
                  y={p.y}
                  selected={n.id === selectedId}
                  inChain={inChainNode(n.id)}
                  dimmed={!!dimNode(n)}
                  onClick={() => onSelect(n.id)}
                />
              </g>
            );
          })}
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 12,
          fontFamily: FONT_MONO,
          fontSize: 10,
          color: COL.textFaint,
          letterSpacing: 0.4,
          pointerEvents: "none",
        }}
      >
        {Math.round(view.scale * 100)}% · {index.nodes.length} nodes ·{" "}
        {index.edges.length} edges
      </div>
    </div>
  );
}

interface EdgeProps {
  edge: GraphEdge;
  positions: Record<string, { x: number; y: number }>;
  layout: LayoutKind;
  inChain: boolean;
  dimmed: boolean;
}

function Edge({ edge, positions, layout, inChain, dimmed }: EdgeProps) {
  const a = positions[edge.from];
  const b = positions[edge.to];
  if (!a || !b) return null;
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  if (layout === "sequence") {
    x1 = a.x + NODE_W;
    y1 = a.y + NODE_H / 2;
    x2 = b.x;
    y2 = b.y + NODE_H / 2;
  } else if (layout === "hierarchical") {
    x1 = a.x + NODE_W / 2;
    y1 = a.y + NODE_H;
    x2 = b.x + NODE_W / 2;
    y2 = b.y;
  } else {
    x1 = a.x + NODE_W / 2;
    y1 = a.y + NODE_H / 2;
    x2 = b.x + NODE_W / 2;
    y2 = b.y + NODE_H / 2;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  const path =
    layout === "sequence"
      ? `M ${x1} ${y1} C ${x1 + Math.min(120, Math.abs(dx) * 0.5)} ${y1}, ${x2 - Math.min(120, Math.abs(dx) * 0.5)} ${y2}, ${x2} ${y2}`
      : layout === "hierarchical"
        ? `M ${x1} ${y1} C ${x1} ${y1 + Math.min(60, Math.abs(dy) * 0.5)}, ${x2} ${y2 - Math.min(60, Math.abs(dy) * 0.5)}, ${x2} ${y2}`
        : `M ${x1} ${y1} L ${x2} ${y2}`;
  const stroke = inChain
    ? COL.edgeChain
    : dimmed
      ? COL.edgeFaded
      : COL.edgeIdle;
  const opacity = dimmed && !inChain ? 0.4 : 1;
  const strokeWidth = inChain ? 1.5 : 0.7;
  const dasharray = edge.kind === "sends" ? "3 3" : "0";
  return (
    <g style={{ opacity, transition: "opacity .15s" }}>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        markerEnd={`url(#arrow${inChain ? "-chain" : ""})`}
      />
    </g>
  );
}

interface NodeCardProps {
  node: GraphNode;
  x: number;
  y: number;
  selected: boolean;
  inChain: boolean;
  dimmed: boolean;
  onClick: () => void;
}

function NodeCard({ node, x, y, selected, inChain, dimmed, onClick }: NodeCardProps) {
  const w = NODE_W;
  const h = NODE_H;
  const meta = KIND_META[node.kind];
  const opacity = dimmed ? 0.18 : 1;
  const borderColor = selected
    ? COL.accent
    : inChain
      ? COL.accentText
      : COL.borderStrong;
  const borderWidth = selected ? 1.5 : inChain ? 1 : 0.5;
  const bg = selected
    ? COL.accentSoft
    : inChain
      ? "#fff"
      : KIND_BG[node.kind] || "#fff";
  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ opacity, cursor: "pointer", transition: "opacity .15s" }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={4}
        fill={bg}
        stroke={borderColor}
        strokeWidth={borderWidth}
      />
      <g transform="translate(11, 11)">
        <KindGlyph kind={node.kind} />
      </g>
      <text
        x={36}
        y={16}
        fontFamily={FONT_MONO}
        fontSize={9.5}
        fill={COL.textFaint}
        letterSpacing={0.3}
        style={{ textTransform: "uppercase" }}
      >
        {meta.label}
      </text>
      <text
        x={36}
        y={31}
        fontFamily="Inter, system-ui, sans-serif"
        fontSize={12.5}
        fontWeight={500}
        fill={COL.text}
      >
        {node.name.length > 22 ? node.name.slice(0, 21) + "…" : node.name}
      </text>
    </g>
  );
}
