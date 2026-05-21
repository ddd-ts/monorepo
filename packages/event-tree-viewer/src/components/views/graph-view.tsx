import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
    <SyncedHorizontalSectionsMemoed
      sections={sections}
      index={index}
      expansion={expansion}
      settings={settings}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}

function SyncedHorizontalSectionsMemoed({
  sections,
  ...rest
}: {
  sections: ComponentSection[]
  index: GraphIndex
  expansion: ExpansionApi
  settings: Settings
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
}) {
  const panels = useMemo(() => groupByDomainPanel(sections), [sections])
  return <SyncedHorizontalSections panels={panels} {...rest} />
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

const STICKY_HEADER_H = 36

function SyncedHorizontalSections({
  panels,
  index,
  expansion,
  settings,
  selectedId,
  onSelect,
}: {
  panels: DomainPanel[]
  index: GraphIndex
  expansion: ExpansionApi
  settings: Settings
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stickyHeaderRef = useRef<HTMLDivElement>(null)
  const panelEls = useRef(new Map<string, HTMLDivElement>())
  const panelOffsets = useRef<
    { key: string; top: number; bottom: number }[]
  >([])
  const plotEls = useRef(new Map<string, { el: HTMLDivElement; width: number }>())
  const hoveredIdRef = useRef<NodeId | null>(null)
  const [contentSize, setContentSize] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  })
  const [activePanelKey, setActivePanelKey] = useState<string | null>(null)
  const activePanelKeyRef = useRef<string | null>(null)
  const viewportWRef = useRef(0)

  const applyDimming = useCallback(() => {
    const root = transformRef.current
    if (!root) return
    const focused = selectedId ?? hoveredIdRef.current
    const related = focused ? computeRelatedIds(index, focused) : null
    for (const el of root.querySelectorAll<HTMLElement>("[data-node-id]")) {
      const id = el.getAttribute("data-node-id")!
      const dimmed = related !== null && !related.has(id)
      el.classList.toggle("opacity-25", dimmed)
      const selected = id === selectedId
      el.classList.toggle("ring-2", selected)
      el.classList.toggle("ring-ring", selected)
      el.setAttribute("aria-pressed", selected ? "true" : "false")
    }
    const sortedEdges = new Map<
      Element,
      { dimmed: SVGPathElement[]; normal: SVGPathElement[] }
    >()
    for (const el of root.querySelectorAll<SVGPathElement>("[data-edge]")) {
      const from = el.getAttribute("data-from")!
      const to = el.getAttribute("data-to")!
      const dimmed =
        related !== null && !(related.has(from) && related.has(to))
      el.classList.toggle("stroke-graph-dim", dimmed)
      el.classList.toggle("stroke-graph-edge", !dimmed)
      const parent = el.parentElement
      if (!parent) continue
      let group = sortedEdges.get(parent)
      if (!group) {
        group = { dimmed: [], normal: [] }
        sortedEdges.set(parent, group)
      }
      ;(dimmed ? group.dimmed : group.normal).push(el)
    }
    if (related !== null) {
      for (const [parent, group] of sortedEdges) {
        for (const el of group.dimmed) parent.appendChild(el)
        for (const el of group.normal) parent.appendChild(el)
      }
    }
    const sortedLabels = new Map<
      Element,
      { dimmed: HTMLDivElement[]; normal: HTMLDivElement[] }
    >()
    for (const el of root.querySelectorAll<HTMLDivElement>(
      "[data-edge-label]"
    )) {
      const from = el.getAttribute("data-from")!
      const to = el.getAttribute("data-to")!
      const dimmed =
        related !== null && !(related.has(from) && related.has(to))
      el.classList.toggle("text-graph-dim", dimmed)
      el.classList.toggle("text-muted-foreground", !dimmed)
      const parent = el.parentElement
      if (!parent) continue
      let group = sortedLabels.get(parent)
      if (!group) {
        group = { dimmed: [], normal: [] }
        sortedLabels.set(parent, group)
      }
      ;(dimmed ? group.dimmed : group.normal).push(el)
    }
    if (related !== null) {
      for (const [parent, group] of sortedLabels) {
        for (const el of group.dimmed) parent.appendChild(el)
        for (const el of group.normal) parent.appendChild(el)
      }
    }
  }, [index, selectedId])

  const handleHover = useCallback(
    (id: NodeId | null) => {
      hoveredIdRef.current = id
      applyDimming()
    },
    [applyDimming]
  )

  const registerPanelEl = useCallback(
    (key: string, el: HTMLDivElement | null) => {
      if (el) panelEls.current.set(key, el)
      else panelEls.current.delete(key)
    },
    []
  )

  const registerPlotEl = useCallback(
    (key: string, el: HTMLDivElement | null, width: number) => {
      if (el) plotEls.current.set(key, { el, width })
      else plotEls.current.delete(key)
    },
    []
  )

  const rebuildPanelOffsetsCache = useCallback(() => {
    const offsets: { key: string; top: number; bottom: number }[] = []
    for (const panel of panels) {
      const el = panelEls.current.get(panel.key)
      if (!el) continue
      const top = el.offsetTop
      offsets.push({ key: panel.key, top, bottom: top + el.offsetHeight })
    }
    panelOffsets.current = offsets
  }, [panels])

  const applyStickyTransform = useCallback(() => {
    const v = viewportRef.current
    if (!v) return
    const ty = v.scrollTop
    const offsets = panelOffsets.current
    let overlayY = 0
    for (let i = 0; i < offsets.length; i++) {
      const o = offsets[i]
      if (o.top <= ty && ty < o.bottom) {
        const nextTop = offsets[i + 1]?.top ?? null
        if (nextTop !== null) {
          const nextTopInViewport = nextTop - ty
          if (nextTopInViewport < STICKY_HEADER_H) {
            overlayY = nextTopInViewport - STICKY_HEADER_H
          }
        }
        break
      }
    }
    const overlay = stickyHeaderRef.current
    if (overlay) {
      overlay.style.transform = `translate3d(0, ${overlayY}px, 0)`
    }
  }, [])

  const updateSticky = useCallback(
    (ty: number) => {
      const offsets = panelOffsets.current
      let activeKey: string | null = null
      for (let i = 0; i < offsets.length; i++) {
        const o = offsets[i]
        if (o.top <= ty && ty < o.bottom) {
          activeKey = o.key
          break
        }
      }
      if (activeKey !== activePanelKeyRef.current) {
        activePanelKeyRef.current = activeKey
        setActivePanelKey(activeKey)
        // Transform will be re-applied by the keyed inner element's ref
        // callback once React commits the new label.
      } else {
        applyStickyTransform()
      }
    },
    [applyStickyTransform]
  )

  const applyPlotTransforms = useCallback((left: number) => {
    const vw = viewportWRef.current
    for (const { el, width } of plotEls.current.values()) {
      const max = width > vw ? width - vw : 0
      const clamped = left < max ? left : max
      el.style.transform = `translate3d(${-clamped}px, 0, 0)`
    }
  }, [])

  const applyTransform = useCallback(
    (left: number, top: number) => {
      const t = transformRef.current
      if (t) t.style.transform = `translate3d(0, ${-top}px, 0)`
      applyPlotTransforms(left)
      updateSticky(top)
    },
    [applyPlotTransforms, updateSticky]
  )

  const handleViewportScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const v = e.currentTarget
      applyTransform(v.scrollLeft, v.scrollTop)
    },
    [applyTransform]
  )

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
    const el = transformRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      setContentSize({ w: Math.ceil(r.width), h: Math.ceil(r.height) })
      rebuildPanelOffsetsCache()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [rebuildPanelOffsetsCache])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const ro = new ResizeObserver(([entry]) => {
      viewportWRef.current = entry.contentRect.width
      const v = viewportRef.current
      if (v) applyPlotTransforms(v.scrollLeft)
    })
    ro.observe(host)
    return () => ro.disconnect()
  }, [applyPlotTransforms])

  useEffect(() => {
    const v = viewportRef.current
    if (!v) return
    applyTransform(v.scrollLeft, v.scrollTop)
  }, [contentSize, applyTransform])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const onWheel = (e: WheelEvent) => {
      const v = viewportRef.current
      if (!v) return
      const hMax = Math.max(0, v.scrollWidth - v.clientWidth)
      const vMax = Math.max(0, v.scrollHeight - v.clientHeight)
      const newLeft = Math.max(0, Math.min(hMax, v.scrollLeft + e.deltaX))
      const newTop = Math.max(0, Math.min(vMax, v.scrollTop + e.deltaY))
      const changed =
        Math.abs(newLeft - v.scrollLeft) > 0.5 ||
        Math.abs(newTop - v.scrollTop) > 0.5
      if (!changed) return
      e.preventDefault()
      v.scrollLeft = newLeft
      v.scrollTop = newTop
    }
    host.addEventListener("wheel", onWheel, { passive: false })
    return () => host.removeEventListener("wheel", onWheel)
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let pan:
      | {
          startX: number
          startY: number
          startLeft: number
          startTop: number
          pointerId: number
          moved: boolean
        }
      | null = null
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      const v = viewportRef.current
      if (!v) return
      pan = {
        startX: e.clientX,
        startY: e.clientY,
        startLeft: v.scrollLeft,
        startTop: v.scrollTop,
        pointerId: e.pointerId,
        moved: false,
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!pan || e.pointerId !== pan.pointerId) return
      const v = viewportRef.current
      if (!v) return
      const dx = pan.startX - e.clientX
      const dy = pan.startY - e.clientY
      if (!pan.moved && Math.hypot(dx, dy) < 5) return
      pan.moved = true
      e.preventDefault()
      const hMax = Math.max(0, v.scrollWidth - v.clientWidth)
      const vMax = Math.max(0, v.scrollHeight - v.clientHeight)
      v.scrollLeft = Math.max(0, Math.min(hMax, pan.startLeft + dx))
      v.scrollTop = Math.max(0, Math.min(vMax, pan.startTop + dy))
    }
    const endPan = (e: PointerEvent) => {
      if (pan?.pointerId === e.pointerId) pan = null
    }
    host.addEventListener("pointerdown", onPointerDown)
    host.addEventListener("pointermove", onPointerMove, { passive: false })
    host.addEventListener("pointerup", endPan)
    host.addEventListener("pointercancel", endPan)
    return () => {
      host.removeEventListener("pointerdown", onPointerDown)
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerup", endPan)
      host.removeEventListener("pointercancel", endPan)
    }
  }, [])

  useEffect(() => {
    applyDimming()
  }, [applyDimming, panels])

  useEffect(() => {
    if (!selectedId) return
    const panelKey = nodeToPanelKey.get(selectedId)
    if (!panelKey) return
    if (!expansion.isExpanded(panelKey)) expansion.toggle(panelKey)
    const raf = requestAnimationFrame(() => {
      const host = hostRef.current
      const transform = transformRef.current
      const viewport = viewportRef.current
      if (!host || !transform || !viewport) return
      const escaped =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(selectedId)
          : selectedId.replace(/(["\\])/g, "\\$1")
      const el = transform.querySelector<HTMLElement>(
        `[data-node-id="${escaped}"]`
      )
      if (!el) return
      const tRect = transform.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      const naturalLeft = eRect.left - tRect.left
      const naturalTop = eRect.top - tRect.top
      const viewW = host.clientWidth
      const viewH = host.clientHeight
      const hMax = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      const vMax = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      const targetLeft = Math.max(
        0,
        Math.min(hMax, naturalLeft + eRect.width / 2 - viewW / 2)
      )
      const targetTop = Math.max(
        0,
        Math.min(vMax, naturalTop + eRect.height / 2 - viewH / 2)
      )
      viewport.scrollLeft = targetLeft
      viewport.scrollTop = targetTop
    })
    return () => cancelAnimationFrame(raf)
    // Re-running only on selectedId change is intentional: rerunning on
    // nodeToPanelKey / expansion changes would yank the viewport back to the
    // selected node every time the user hovers or expands a panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const activePanel =
    activePanelKey != null
      ? panels.find((p) => p.key === activePanelKey)
      : null

  return (
    <div
      ref={hostRef}
      className="relative h-full min-h-0 flex-1 touch-none overflow-hidden"
    >
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
      <div className="absolute inset-0 overflow-hidden">
        <div
          ref={transformRef}
          className="absolute top-0 left-0 flex w-max flex-col will-change-transform"
        >
          {panels.map((panel) => (
            <DomainPanelView
              key={panel.key}
              panel={panel}
              expanded={expansion.isExpanded(panel.key)}
              onToggle={() => expansion.toggle(panel.key)}
              settings={settings}
              onSelect={onSelect}
              onHover={handleHover}
              registerPanelEl={registerPanelEl}
              registerPlotEl={registerPlotEl}
            />
          ))}
        </div>
      </div>
      <div
        ref={stickyHeaderRef}
        className="pointer-events-none absolute top-0 right-0 left-0 z-10 will-change-transform"
        style={{ visibility: activePanel ? "visible" : "hidden" }}
      >
        {activePanel && (
          <div
            key={activePanel.key}
            ref={(el) => {
              if (el) applyStickyTransform()
            }}
            className="pointer-events-auto bg-background px-6"
          >
            <DomainHeader
              label={activePanel.domain.label}
              expanded={expansion.isExpanded(activePanel.key)}
              onToggle={() => expansion.toggle(activePanel.key)}
              meta={panelMeta(activePanel)}
            />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 z-20">
        <ScrollAreaPrimitive.Root className="pointer-events-none size-full">
          <ScrollAreaPrimitive.Viewport
            ref={viewportRef}
            onScroll={handleViewportScroll}
            className="pointer-events-none size-full"
          >
            <div
              style={{
                width: contentSize.w,
                height: contentSize.h,
                pointerEvents: "none",
              }}
            />
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.Scrollbar
            orientation="horizontal"
            className="pointer-events-auto flex h-3 touch-none border-t border-t-transparent bg-muted/40 p-px transition-colors select-none"
          >
            <ScrollAreaPrimitive.Thumb className="h-full rounded-full bg-border hover:bg-muted-foreground/60" />
          </ScrollAreaPrimitive.Scrollbar>
          <ScrollAreaPrimitive.Scrollbar
            orientation="vertical"
            className="pointer-events-auto flex w-3 touch-none border-l border-l-transparent bg-muted/40 p-px transition-colors select-none"
          >
            <ScrollAreaPrimitive.Thumb className="w-full rounded-full bg-border hover:bg-muted-foreground/60" />
          </ScrollAreaPrimitive.Scrollbar>
          <ScrollAreaPrimitive.Corner className="bg-muted/40" />
        </ScrollAreaPrimitive.Root>
      </div>
    </div>
  )
}

function panelMeta(panel: DomainPanel): string {
  const { totals, components } = panel
  return `${totals.nodes} node${totals.nodes === 1 ? "" : "s"} · ${totals.edges} edge${totals.edges === 1 ? "" : "s"}${
    components.length > 1 ? ` · ${components.length} graphs` : ""
  }`
}

const DomainPanelView = memo(function DomainPanelView({
  panel,
  expanded,
  onToggle,
  settings,
  onSelect,
  onHover,
  registerPanelEl,
  registerPlotEl,
}: {
  panel: DomainPanel
  expanded: boolean
  onToggle: () => void
  settings: Settings
  onSelect: (id: NodeId) => void
  onHover: (id: NodeId | null) => void
  registerPanelEl: (key: string, el: HTMLDivElement | null) => void
  registerPlotEl: (
    key: string,
    el: HTMLDivElement | null,
    width: number
  ) => void
}) {
  const { key, domain, components } = panel
  const domainPrefix = domainPrefixFromLabel(domain.label)
  const meta = panelMeta(panel)
  const setRef = useCallback(
    (el: HTMLDivElement | null) => registerPanelEl(key, el),
    [registerPanelEl, key]
  )
  return (
    <section ref={setRef} className="flex flex-col">
      <div className="bg-background px-6">
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
              onSelect={onSelect}
              onHover={onHover}
              registerPlotEl={registerPlotEl}
            />
          ))}
        </div>
      )}
    </section>
  )
})

const ComponentPlot = memo(function ComponentPlot({
  section,
  settings,
  domainPrefix,
  onSelect,
  onHover,
  registerPlotEl,
}: {
  section: ComponentSection
  settings: Settings
  domainPrefix: string
  onSelect: (id: NodeId) => void
  onHover: (id: NodeId | null) => void
  registerPlotEl: (
    key: string,
    el: HTMLDivElement | null,
    width: number
  ) => void
}) {
  const { key, laid } = section
  const contentWidth = laid.width + 48
  const setRef = useCallback(
    (el: HTMLDivElement | null) => registerPlotEl(key, el, contentWidth),
    [registerPlotEl, key, contentWidth]
  )
  return (
    <div
      ref={setRef}
      className="px-6 will-change-transform"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: `${contentWidth}px ${laid.height}px`,
      }}
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
              data-edge
              data-from={edge.fromId}
              data-to={edge.toId}
              d={edge.path}
              fill="none"
              className="stroke-graph-edge transition-colors"
              strokeWidth={1.25}
              markerEnd="url(#graph-arrow)"
            />
          ))}
        </svg>
        {laid.edges.map((edge) =>
          edge.label ? (
            <div
              key={`${edge.id}-label`}
              data-edge-label
              data-from={edge.fromId}
              data-to={edge.toId}
              className="pointer-events-none absolute rounded bg-background px-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase transition-colors"
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
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  )
})

const NodeBox = memo(function NodeBox({
  node,
  hideDomainPrefix,
  domainPrefix,
  onSelect,
  onHover,
}: {
  node: LaidOutNode
  hideDomainPrefix: boolean
  domainPrefix: string
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
      aria-pressed="false"
      data-node-id={node.id}
      className="group/nodebox absolute justify-start gap-2 overflow-hidden bg-background px-3 py-2 text-sm font-normal transition-opacity hover:z-10 hover:overflow-visible"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
    >
      <NodeBadge kind={node.node.type} />
      <span className="truncate group-hover/nodebox:overflow-visible">
        <NodeName
          name={node.node.name}
          kind={node.node.type}
          domainPrefix={domainPrefix}
          hide={hideDomainPrefix}
        />
      </span>
    </Button>
  )
})

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
