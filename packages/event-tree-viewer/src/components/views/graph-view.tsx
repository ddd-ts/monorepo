import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ELK from "elkjs/lib/elk.bundled.js"
import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { Button } from "@/components/ui/button"
import { NodeBadge } from "@/components/node-badge"
import { DomainHeader } from "@/components/domain-header"
import { NodeName } from "@/components/node-name"
import { nodeId, type GraphIndex, type NodeId } from "@/domain/graph"
import type { Node } from "@/domain/node"
import { edgeKind, verbFor, type Edge } from "@/domain/edge"
import type { Direction } from "@/domain/direction"
import {
  type NodeDomain,
  domainPrefixFromLabel,
  groupByDomain,
} from "@/domain/domain-grouping"
import { effectiveRoots } from "@/domain/roots"
import type { DomainMap } from "@/application/use-domains"
import type { ExpansionApi } from "@/application/use-expansion"
import type { Settings } from "@/application/use-settings"

const elk = new ELK()

const NODE_W = 220
const NODE_H = 44
const LABEL_W = 80
const LABEL_H = 14

interface GraphViewProps {
  index: GraphIndex
  visibleNodes: Node[]
  domains: DomainMap
  direction: Direction
  settings: Settings
  expansion: ExpansionApi
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
}

interface LaidOutNode {
  id: NodeId
  node: Node
  x: number
  y: number
  width: number
  height: number
}

interface LaidOutEdge {
  id: string
  fromId: NodeId
  toId: NodeId
  path: string
  label: { text: string; x: number; y: number } | null
}

interface LaidOutGraph {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  width: number
  height: number
}

interface ComponentSection {
  key: string
  domain: NodeDomain
  laid: LaidOutGraph
}

interface DomainPanel {
  key: string
  domain: NodeDomain
  totals: { nodes: number; edges: number }
  components: ComponentSection[]
}

export function GraphView({
  index,
  visibleNodes,
  domains,
  direction,
  settings,
  expansion,
  selectedId,
  onSelect,
}: GraphViewProps) {
  const groups = useMemo(
    () => buildComponentGroups(index, visibleNodes, domains, direction),
    [index, visibleNodes, domains, direction]
  )
  const [hoveredId, setHoveredId] = useState<NodeId | null>(null)
  const focusedId = selectedId ?? hoveredId
  const relatedIds = useMemo(
    () => computeRelatedIds(index, focusedId),
    [index, focusedId]
  )
  const [sections, setSections] = useState<ComponentSection[] | null>(null)
  const [status, setStatus] = useState<"idle" | "laying" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!groups.length) {
      setSections([])
      setStatus("idle")
      return
    }
    setStatus("laying")
    let cancelled = false
    Promise.all(
      groups.map(async (g) => ({
        key: g.key,
        domain: g.domain,
        laid: await layoutGraph(g.nodes, g.edges, direction),
      }))
    )
      .then((next) => {
        if (cancelled) return
        setSections(next)
        setStatus("idle")
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus("error")
      })
    return () => {
      cancelled = true
    }
  }, [groups, direction])

  if (!visibleNodes.length) {
    return (
      <p className="px-6 py-4 text-sm text-muted-foreground">
        No matching nodes.
      </p>
    )
  }

  if (!groups.length) {
    return (
      <p className="px-6 py-4 text-sm text-muted-foreground">
        No connected nodes — every matching node is isolated.
      </p>
    )
  }

  if (status === "error") {
    return (
      <p className="px-6 py-4 text-sm text-destructive">
        Layout failed: {error}
      </p>
    )
  }

  if (!sections) {
    return (
      <p className="px-6 py-4 text-sm text-muted-foreground">
        Computing layout…
      </p>
    )
  }

  return (
    <SyncedHorizontalSections
      panels={groupByDomainPanel(sections)}
      expansion={expansion}
      settings={settings}
      selectedId={selectedId}
      relatedIds={relatedIds}
      onSelect={onSelect}
      onHover={setHoveredId}
    />
  )
}

function groupByDomainPanel(sections: ComponentSection[]): DomainPanel[] {
  const panels = new Map<string, DomainPanel>()
  for (const s of sections) {
    const existing = panels.get(s.domain.key)
    if (existing) {
      existing.components.push(s)
      existing.totals.nodes += s.laid.nodes.length
      existing.totals.edges += s.laid.edges.length
    } else {
      panels.set(s.domain.key, {
        key: s.domain.key,
        domain: s.domain,
        totals: { nodes: s.laid.nodes.length, edges: s.laid.edges.length },
        components: [s],
      })
    }
  }
  return [...panels.values()].sort((a, b) =>
    a.domain.label.localeCompare(b.domain.label)
  )
}

function SyncedHorizontalSections({
  panels,
  expansion,
  settings,
  selectedId,
  relatedIds,
  onSelect,
  onHover,
}: {
  panels: DomainPanel[]
  expansion: ExpansionApi
  settings: Settings
  selectedId: NodeId | null
  relatedIds: ReadonlySet<string> | null
  onSelect: (id: NodeId) => void
  onHover: (id: NodeId | null) => void
}) {
  const scrollXRef = useRef(0)
  const viewportsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const externalRef = useRef(false)
  const maxWidth = useMemo(() => {
    let m = 0
    for (const panel of panels) {
      if (!expansion.isExpanded(panel.key)) continue
      for (const c of panel.components) m = Math.max(m, c.laid.width)
    }
    return m
  }, [panels, expansion])

  const registerViewport = useCallback(
    (key: string, el: HTMLDivElement | null) => {
      const map = viewportsRef.current
      if (el) {
        map.set(key, el)
        externalRef.current = true
        const max = Math.max(0, el.scrollWidth - el.clientWidth)
        el.scrollLeft = Math.min(scrollXRef.current, max)
        requestAnimationFrame(() => {
          externalRef.current = false
        })
      } else {
        map.delete(key)
      }
    },
    []
  )

  const handleScroll = useCallback((source: HTMLDivElement) => {
    if (externalRef.current) return
    const global = viewportsRef.current.get("__global__")
    if (source !== global && global) {
      // Per-section scroll: lift to global, which then re-broadcasts.
      const globalMax = Math.max(0, global.scrollWidth - global.clientWidth)
      const next = Math.min(globalMax, source.scrollLeft)
      if (Math.abs(global.scrollLeft - next) > 0.5) {
        global.scrollLeft = next
        return
      }
    }
    scrollXRef.current = source.scrollLeft
    externalRef.current = true
    for (const [, el] of viewportsRef.current) {
      if (el === source) continue
      const max = Math.max(0, el.scrollWidth - el.clientWidth)
      const target = Math.min(scrollXRef.current, max)
      if (Math.abs(el.scrollLeft - target) > 0.5) el.scrollLeft = target
    }
    requestAnimationFrame(() => {
      externalRef.current = false
    })
  }, [])

  const wheelHostRef = useRef<HTMLDivElement>(null)

  const nodeToPanelKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const panel of panels) {
      for (const component of panel.components) {
        for (const node of component.laid.nodes) {
          if (!map.has(node.id)) map.set(node.id, panel.key)
        }
      }
    }
    return map
  }, [panels])

  useEffect(() => {
    if (!selectedId) return
    const panelKey = nodeToPanelKey.get(selectedId)
    if (!panelKey) return
    if (!expansion.isExpanded(panelKey)) expansion.toggle(panelKey)
    const raf = requestAnimationFrame(() => {
      const host = wheelHostRef.current
      if (!host) return
      const escaped =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(selectedId)
          : selectedId.replace(/(["\\])/g, "\\$1")
      const el = host.querySelector<HTMLElement>(
        `[data-node-id="${escaped}"]`
      )
      el?.scrollIntoView({ block: "center", inline: "center", behavior: "auto" })
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedId, nodeToPanelKey, expansion])

  useEffect(() => {
    const host = wheelHostRef.current
    if (!host) return
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0
      if (dx === 0) return
      const global = viewportsRef.current.get("__global__")
      if (!global) return
      const max = Math.max(0, global.scrollWidth - global.clientWidth)
      const next = Math.max(0, Math.min(max, global.scrollLeft + dx))
      if (Math.abs(global.scrollLeft - next) < 0.5) return
      e.preventDefault()
      global.scrollLeft = next
    }
    host.addEventListener("wheel", onWheel, { passive: false })
    return () => host.removeEventListener("wheel", onWheel)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <svg width="0" height="0" className="pointer-events-none absolute">
        <defs>
          <marker
            id="graph-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="fill-muted-foreground"
            />
          </marker>
        </defs>
      </svg>
      <div
        ref={wheelHostRef}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="flex flex-col">
          {panels.map((panel) => (
            <DomainPanelView
              key={panel.key}
              panel={panel}
              expanded={expansion.isExpanded(panel.key)}
              onToggle={() => expansion.toggle(panel.key)}
              settings={settings}
              selectedId={selectedId}
              relatedIds={relatedIds}
              onSelect={onSelect}
              onHover={onHover}
              registerViewport={registerViewport}
              onViewportScroll={handleScroll}
            />
          ))}
        </div>
      </div>
      {maxWidth > 0 && (
        <GlobalHorizontalScrollbar
          maxWidth={maxWidth}
          registerViewport={registerViewport}
          onViewportScroll={handleScroll}
        />
      )}
    </div>
  )
}

function GlobalHorizontalScrollbar({
  maxWidth,
  registerViewport,
  onViewportScroll,
}: {
  maxWidth: number
  registerViewport: (key: string, el: HTMLDivElement | null) => void
  onViewportScroll: (el: HTMLDivElement) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    registerViewport("__global__", viewportRef.current)
    return () => registerViewport("__global__", null)
  }, [registerViewport])
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => onViewportScroll(e.currentTarget),
    [onViewportScroll]
  )
  return (
    <ScrollAreaPrimitive.Root className="relative shrink-0 border-t bg-background">
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        onScroll={handleScroll}
        className="size-full"
        style={{ height: 1 }}
      >
        <div style={{ width: maxWidth, height: 1 }} />
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex h-3 touch-none border-t border-t-transparent bg-muted/40 p-px transition-colors select-none"
      >
        <ScrollAreaPrimitive.Thumb className="h-full rounded-full bg-border hover:bg-muted-foreground/60" />
      </ScrollAreaPrimitive.Scrollbar>
    </ScrollAreaPrimitive.Root>
  )
}

function DomainPanelView({
  panel,
  expanded,
  onToggle,
  settings,
  selectedId,
  relatedIds,
  onSelect,
  onHover,
  registerViewport,
  onViewportScroll,
}: {
  panel: DomainPanel
  expanded: boolean
  onToggle: () => void
  settings: Settings
  selectedId: NodeId | null
  relatedIds: ReadonlySet<string> | null
  onSelect: (id: NodeId) => void
  onHover: (id: NodeId | null) => void
  registerViewport: (key: string, el: HTMLDivElement | null) => void
  onViewportScroll: (el: HTMLDivElement) => void
}) {
  const { domain, totals, components } = panel
  const domainPrefix = domainPrefixFromLabel(domain.label)
  const meta = `${totals.nodes} node${totals.nodes === 1 ? "" : "s"} · ${totals.edges} edge${totals.edges === 1 ? "" : "s"}${
    components.length > 1 ? ` · ${components.length} graphs` : ""
  }`
  return (
    <section className="flex flex-col">
      <div className="sticky top-0 z-20 bg-background px-6">
        <DomainHeader
          label={domain.label}
          expanded={expanded}
          onToggle={onToggle}
          meta={meta}
        />
      </div>
      {expanded && (
        <div className="flex flex-col gap-4 pt-2 pb-4">
          {components.map((component) => (
            <ComponentPlot
              key={component.key}
              section={component}
              settings={settings}
              domainPrefix={domainPrefix}
              selectedId={selectedId}
              relatedIds={relatedIds}
              onSelect={onSelect}
              onHover={onHover}
              registerViewport={registerViewport}
              onViewportScroll={onViewportScroll}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ComponentPlot({
  section,
  settings,
  domainPrefix,
  selectedId,
  relatedIds,
  onSelect,
  onHover,
  registerViewport,
  onViewportScroll,
}: {
  section: ComponentSection
  settings: Settings
  domainPrefix: string
  selectedId: NodeId | null
  relatedIds: ReadonlySet<string> | null
  onSelect: (id: NodeId) => void
  onHover: (id: NodeId | null) => void
  registerViewport: (key: string, el: HTMLDivElement | null) => void
  onViewportScroll: (el: HTMLDivElement) => void
}) {
  const { key, laid } = section
  const setRef = useCallback(
    (el: HTMLDivElement | null) => registerViewport(key, el),
    [registerViewport, key]
  )
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => onViewportScroll(e.currentTarget),
    [onViewportScroll]
  )
  const isEdgeRelated = (edge: LaidOutEdge) =>
    !relatedIds || (relatedIds.has(edge.fromId) && relatedIds.has(edge.toId))
  const isNodeRelated = (id: NodeId) => !relatedIds || relatedIds.has(id)
  return (
    <div
      ref={setRef}
      onScroll={handleScroll}
      className="scrollbar-hidden overflow-x-auto px-6"
    >
      <div
        className="relative"
        style={{ width: laid.width, height: laid.height }}
      >
        <svg
          width={laid.width}
          height={laid.height}
          className="pointer-events-none absolute inset-0"
        >
          {laid.edges.map((edge) => (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              className={`stroke-muted-foreground/60 transition-opacity ${
                isEdgeRelated(edge) ? "" : "opacity-15"
              }`}
              strokeWidth={1.25}
              markerEnd="url(#graph-arrow)"
            />
          ))}
        </svg>
        {laid.edges.map((edge) =>
          edge.label ? (
            <div
              key={`${edge.id}-label`}
              className={`pointer-events-none absolute rounded bg-background px-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase transition-opacity ${
                isEdgeRelated(edge) ? "" : "opacity-25"
              }`}
              style={{
                left: edge.label.x,
                top: edge.label.y,
                width: LABEL_W,
                height: LABEL_H,
                lineHeight: `${LABEL_H}px`,
                textAlign: "center",
              }}
            >
              {edge.label.text}
            </div>
          ) : null
        )}
        {laid.nodes.map((n) => (
          <NodeBox
            key={n.id}
            node={n}
            hideDomainPrefix={settings.hideDomainPrefix}
            domainPrefix={domainPrefix}
            selected={selectedId === n.id}
            dimmed={!isNodeRelated(n.id)}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  )
}

function NodeBox({
  node,
  hideDomainPrefix,
  domainPrefix,
  selected,
  dimmed,
  onSelect,
  onHover,
}: {
  node: LaidOutNode
  hideDomainPrefix: boolean
  domainPrefix: string
  selected: boolean
  dimmed: boolean
  onSelect: (id: NodeId) => void
  onHover: (id: NodeId | null) => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      aria-pressed={selected}
      data-node-id={node.id}
      className={`absolute justify-start gap-2 overflow-hidden bg-background px-3 py-2 text-sm font-normal transition-opacity ${
        selected ? "ring-2 ring-ring" : ""
      } ${dimmed ? "opacity-25" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
    >
      <NodeBadge kind={node.node.type} />
      <span className="truncate">
        <NodeName
          name={node.node.name}
          kind={node.node.type}
          domainPrefix={domainPrefix}
          hide={hideDomainPrefix}
        />
      </span>
    </Button>
  )
}

async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  direction: Direction
): Promise<LaidOutGraph> {
  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction === "forward" ? "RIGHT" : "LEFT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.spacing.nodeNode": "32",
      "elk.spacing.edgeNode": "24",
      "elk.spacing.edgeEdge": "14",
      "elk.spacing.componentComponent": "120",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.semiInteractive": "true",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.separateConnectedComponents": "true",
    },
    children: nodes.map((n) => {
      const inPos = portPosition("in", direction)
      const outPos = portPosition("out", direction)
      return {
        id: nodeId(n.type, n.name),
        width: NODE_W,
        height: NODE_H,
        layoutOptions: {
          "elk.portConstraints": "FIXED_POS",
        },
        ports: [
          {
            id: portIdFor(n, "in"),
            x: inPos.x,
            y: inPos.y,
            width: 0,
            height: 0,
            layoutOptions: { "port.side": portSide("in", direction) },
          },
          {
            id: portIdFor(n, "out"),
            x: outPos.x,
            y: outPos.y,
            width: 0,
            height: 0,
            layoutOptions: { "port.side": portSide("out", direction) },
          },
        ],
      }
    }),
    edges: edges.map<ElkExtendedEdge>((e, i) => ({
      id: `e${i}`,
      sources: [portIdFor(e.from, "out")],
      targets: [portIdFor(e.to, "in")],
      labels: [
        {
          text: edgeLabel(e, direction),
          width: LABEL_W,
          height: LABEL_H,
        },
      ],
    })),
  }

  const edgeRefs = new Map(
    edges.map((e, i) => [
      `e${i}`,
      {
        fromId: nodeId(e.from.type, e.from.name),
        toId: nodeId(e.to.type, e.to.name),
      },
    ])
  )

  const result = await elk.layout(elkGraph)

  const laidNodes: LaidOutNode[] = (result.children ?? []).flatMap((child) => {
    const id = child.id as NodeId
    const source = nodes.find((n) => nodeId(n.type, n.name) === id)
    if (!source) return []
    return [
      {
        id,
        node: source,
        x: child.x ?? 0,
        y: child.y ?? 0,
        width: child.width ?? NODE_W,
        height: child.height ?? NODE_H,
      },
    ]
  })

  const laidEdges: LaidOutEdge[] = (result.edges ?? []).flatMap((edge) => {
    const section = edge.sections?.[0]
    if (!section) return []
    const ref = edgeRefs.get(edge.id)
    if (!ref) return []
    const points = [
      section.startPoint,
      ...(section.bendPoints ?? []),
      section.endPoint,
    ]
    const path = points
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ")
    const labelShape = edge.labels?.[0]
    const label = labelShape?.text
      ? {
          text: labelShape.text,
          x: labelShape.x ?? 0,
          y: labelShape.y ?? 0,
        }
      : null
    return [
      {
        id: edge.id,
        fromId: ref.fromId,
        toId: ref.toId,
        path,
        label,
      },
    ]
  })

  return {
    nodes: laidNodes,
    edges: laidEdges,
    width: result.width ?? 0,
    height: result.height ?? 0,
  }
}

function edgeLabel(edge: Edge, direction: Direction): string {
  return verbFor(direction, edgeKind(edge))
}

function portIdFor(
  ref: { type: string; name: string },
  side: "in" | "out"
): string {
  return `${ref.type}:${ref.name}:${side}`
}

function portSide(side: "in" | "out", direction: Direction): string {
  const forwardIn = direction === "forward" ? "WEST" : "EAST"
  const forwardOut = direction === "forward" ? "EAST" : "WEST"
  return side === "in" ? forwardIn : forwardOut
}

function portPosition(
  side: "in" | "out",
  direction: Direction
): { x: number; y: number } {
  const y = NODE_H / 2
  const onWest = portSide(side, direction) === "WEST"
  return { x: onWest ? 0 : NODE_W, y }
}

interface ComponentGroupInput {
  key: string
  domain: NodeDomain
  nodes: Node[]
  edges: Edge[]
}

function buildComponentGroups(
  index: GraphIndex,
  visibleNodes: Node[],
  domains: DomainMap,
  direction: Direction
): ComponentGroupInput[] {
  const visibleIds = new Set(
    visibleNodes.map((n) => nodeId(n.type, n.name) as string)
  )
  const visibleRoots = effectiveRoots(index, direction).filter((id) =>
    visibleIds.has(id)
  )
  const domainGroups = groupByDomain(visibleRoots, domains)
  const groups: ComponentGroupInput[] = []
  for (const { domain, rootIds } of domainGroups) {
    const reached = reachableFrom(index, rootIds, direction, visibleIds)
    if (reached.size === 0) continue
    const subgraphNodes = visibleNodes.filter((n) =>
      reached.has(nodeId(n.type, n.name))
    )
    const subgraphEdges = index.graph.edges.filter(
      (e) =>
        reached.has(nodeId(e.from.type, e.from.name)) &&
        reached.has(nodeId(e.to.type, e.to.name))
    )
    const components = splitConnectedComponents(subgraphNodes, subgraphEdges)
    components.forEach((comp, idx) => {
      groups.push({
        key: `${domain.key}::${componentSignature(comp.nodes, idx)}`,
        domain,
        nodes: comp.nodes,
        edges: comp.edges,
      })
    })
  }
  return groups
}

function computeRelatedIds(
  index: GraphIndex,
  selectedId: NodeId | null
): Set<string> | null {
  if (!selectedId) return null
  const related = new Set<string>([selectedId])
  const upQueue: string[] = [selectedId]
  while (upQueue.length) {
    const id = upQueue.shift()!
    for (const e of index.incoming.get(id as NodeId) ?? []) {
      const parentId = nodeId(e.from.type, e.from.name) as string
      if (!related.has(parentId)) {
        related.add(parentId)
        upQueue.push(parentId)
      }
    }
  }
  const downQueue: string[] = [selectedId]
  while (downQueue.length) {
    const id = downQueue.shift()!
    for (const e of index.outgoing.get(id as NodeId) ?? []) {
      const childId = nodeId(e.to.type, e.to.name) as string
      if (!related.has(childId)) {
        related.add(childId)
        downQueue.push(childId)
      }
    }
  }
  return related
}

function reachableFrom(
  index: GraphIndex,
  rootIds: NodeId[],
  direction: Direction,
  visibleIds: ReadonlySet<string>
): Set<string> {
  const reached = new Set<string>()
  const queue: string[] = rootIds.filter((id) => visibleIds.has(id))
  while (queue.length) {
    const id = queue.shift()!
    if (reached.has(id)) continue
    reached.add(id)
    const edges =
      direction === "forward"
        ? (index.outgoing.get(id as NodeId) ?? [])
        : (index.incoming.get(id as NodeId) ?? [])
    for (const edge of edges) {
      const peer = direction === "forward" ? edge.to : edge.from
      const peerId = nodeId(peer.type, peer.name) as string
      if (!visibleIds.has(peerId)) continue
      if (!reached.has(peerId)) queue.push(peerId)
    }
  }
  return reached
}

function splitConnectedComponents(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] }[] {
  const adj = new Map<string, Set<string>>()
  for (const e of edges) {
    const a = nodeId(e.from.type, e.from.name)
    const b = nodeId(e.to.type, e.to.name)
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  const visited = new Set<string>()
  const components: { nodes: Node[]; edges: Edge[] }[] = []
  for (const root of nodes) {
    const rootId = nodeId(root.type, root.name) as string
    if (visited.has(rootId)) continue
    const ids = new Set<string>()
    const queue: string[] = [rootId]
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      ids.add(id)
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) queue.push(nb)
      }
    }
    const compNodes = nodes.filter((n) => ids.has(nodeId(n.type, n.name)))
    const compEdges = edges.filter(
      (e) =>
        ids.has(nodeId(e.from.type, e.from.name)) &&
        ids.has(nodeId(e.to.type, e.to.name))
    )
    if (compNodes.length > 0) components.push({ nodes: compNodes, edges: compEdges })
  }
  return components
}

function componentSignature(nodes: Node[], fallbackIndex: number): string {
  if (!nodes.length) return `c${fallbackIndex}`
  const sorted = nodes
    .map((n) => nodeId(n.type, n.name))
    .sort()
    .slice(0, 3)
    .join(",")
  return sorted
}
