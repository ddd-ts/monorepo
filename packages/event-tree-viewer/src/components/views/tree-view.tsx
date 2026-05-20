import { memo, useCallback, useMemo, useState } from "react"
import { CaretRightIcon } from "@phosphor-icons/react"
import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from "@tanstack/react-virtual"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { NodeBadge } from "@/components/node-badge"
import { DomainHeader } from "@/components/domain-header"
import { NodeName } from "@/components/node-name"
import { type GraphIndex, type NodeId } from "@/domain/graph"
import type { Node } from "@/domain/node"
import { edgeKind, verbFor, type Edge } from "@/domain/edge"
import { effectiveRoots } from "@/domain/roots"
import type { Direction } from "@/domain/direction"
import { groupByDomain } from "@/domain/domain-grouping"
import { flattenTree, type FlatRow } from "@/domain/flatten-tree"
import { type ExpansionApi } from "@/application/use-expansion"
import { useReveal, type RevealApi } from "@/application/use-reveal"
import type { DomainMap } from "@/application/use-domains"
import type { FontSize, Settings } from "@/application/use-settings"

const INDENT = 31
const HEADER_Z = 40
const ROW_Z_BASE = 30
const STICKY_BOTTOM_CLASSES =
  "after:bg-border after:pointer-events-none after:absolute after:bottom-[-1px] after:left-[-9999px] after:right-[-9999px] after:h-px after:content-['']"

const ROW_HEIGHT_BY_FONT: Record<FontSize, number> = {
  sm: 30,
  md: 36,
  lg: 44,
}

const ROW_TEXT_BY_FONT: Record<
  FontSize,
  { main: string; meta: string; padY: string }
> = {
  sm: { main: "text-xs", meta: "text-[10px]", padY: "py-1" },
  md: { main: "text-sm", meta: "text-xs", padY: "py-1.5" },
  lg: { main: "text-base", meta: "text-sm", padY: "py-2" },
}

interface TreeViewProps {
  index: GraphIndex
  visibleNodes: Node[]
  domains: DomainMap
  direction: Direction
  settings: Settings
  expansion: ExpansionApi
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
}

export function TreeView(props: TreeViewProps) {
  const reveal = useReveal()
  const rowHeight = ROW_HEIGHT_BY_FONT[props.settings.fontSize]
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)

  return (
    <ScrollArea ref={setScrollRoot} className="h-full">
      <TreeViewBody
        key={rowHeight}
        {...props}
        reveal={reveal}
        rowHeight={rowHeight}
        scrollRoot={scrollRoot}
      />
    </ScrollArea>
  )
}

interface TreeViewBodyProps extends TreeViewProps {
  reveal: RevealApi
  rowHeight: number
  scrollRoot: HTMLDivElement | null
}

function TreeViewBody({
  index,
  visibleNodes,
  domains,
  direction,
  settings,
  expansion,
  selectedId,
  onSelect,
  reveal,
  rowHeight,
  scrollRoot,
}: TreeViewBodyProps) {
  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((n) => `${n.type}:${n.name}` as NodeId)),
    [visibleNodes]
  )

  const groups = useMemo(() => {
    const visibleRoots = effectiveRoots(index, direction).filter((id) =>
      visibleIds.has(id)
    )
    return groupByDomain(visibleRoots, domains)
  }, [index, direction, visibleIds, domains])

  const rows = useMemo(
    () =>
      flattenTree({
        index,
        groups,
        direction,
        visibleIds,
        isExpanded: expansion.isExpanded,
        isRevealed: reveal.isRevealed,
        headerHeight: rowHeight,
        rowHeight,
      }),
    [index, groups, direction, visibleIds, expansion, reveal, rowHeight]
  )

  const rangeExtractor = useCallback(
    (range: Range) => {
      const first = rows[range.startIndex]
      const ancestors = first?.ancestors ?? []
      const set = new Set<number>([
        ...ancestors,
        ...defaultRangeExtractor(range),
      ])
      return [...set].sort((a, b) => a - b)
    },
    [rows]
  )

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      scrollRoot?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      ) ?? scrollRoot,
    estimateSize: () => rowHeight,
    overscan: 20,
    rangeExtractor,
  })

  const scrollOffset = virtualizer.scrollOffset ?? 0
  const virtualItems = virtualizer.getVirtualItems()
  let pinnedBottomPath: string | null = null
  let deepestStickyTop = -1
  for (const item of virtualItems) {
    const row = rows[item.index]
    if (!row.stickable) continue
    const enter = item.start - row.stickyTop
    const exit = item.start + row.subtreeSize * rowHeight - row.stickyTop
    if (scrollOffset >= enter && scrollOffset < exit) {
      if (row.stickyTop > deepestStickyTop) {
        deepestStickyTop = row.stickyTop
        pinnedBottomPath = row.path
      }
    }
  }

  if (rows.length === 0) {
    return (
      <p className="px-6 py-4 text-sm text-muted-foreground">
        No matching roots.
      </p>
    )
  }

  return (
    <div className="overflow-x-clip px-6 pb-4">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualRow) => (
          <FlatRowSlot
            key={virtualRow.key}
            row={rows[virtualRow.index]}
            naturalY={virtualRow.start}
            size={virtualRow.size}
            rowHeight={rowHeight}
            isPinnedBottom={rows[virtualRow.index].path === pinnedBottomPath}
            direction={direction}
            settings={settings}
            selectedId={selectedId}
            onSelect={onSelect}
            expansion={expansion}
            reveal={reveal}
          />
        ))}
      </div>
    </div>
  )
}

interface FlatRowSlotProps {
  row: FlatRow
  naturalY: number
  size: number
  rowHeight: number
  isPinnedBottom: boolean
  direction: Direction
  settings: Settings
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
  expansion: ExpansionApi
  reveal: RevealApi
}

const FlatRowSlot = memo(function FlatRowSlot({
  row,
  naturalY,
  rowHeight,
  isPinnedBottom,
  direction,
  settings,
  selectedId,
  onSelect,
  expansion,
  reveal,
}: FlatRowSlotProps) {
  const depth = row.kind === "trace-row" ? row.depth : 0
  const zIndex = row.stickable
    ? row.kind === "domain-header"
      ? HEADER_Z
      : ROW_Z_BASE - depth
    : 0

  if (row.stickable) {
    return (
      <div
        className="pointer-events-none absolute right-0 left-0"
        style={{
          top: naturalY,
          height: row.subtreeSize * rowHeight,
          zIndex,
        }}
      >
        <div
          className={`pointer-events-auto sticky flex w-full items-center bg-background ${
            isPinnedBottom ? STICKY_BOTTOM_CLASSES : ""
          }`}
          style={{ top: row.stickyTop, minHeight: rowHeight }}
        >
          <RowContent
            row={row}
            rowHeight={rowHeight}
            direction={direction}
            settings={settings}
            selectedId={selectedId}
            onSelect={onSelect}
            expansion={expansion}
            reveal={reveal}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="absolute right-0 left-0 flex items-center bg-background"
      style={{
        top: naturalY,
        minHeight: rowHeight,
        zIndex,
      }}
    >
      <RowContent
        row={row}
        rowHeight={rowHeight}
        direction={direction}
        settings={settings}
        selectedId={selectedId}
        onSelect={onSelect}
        expansion={expansion}
        reveal={reveal}
      />
    </div>
  )
})

function RowContent({
  row,
  rowHeight,
  direction,
  settings,
  selectedId,
  onSelect,
  expansion,
  reveal,
}: {
  row: FlatRow
  rowHeight: number
  direction: Direction
  settings: Settings
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
  expansion: ExpansionApi
  reveal: RevealApi
}) {
  if (row.kind === "domain-header") {
    return (
      <DomainHeader
        label={row.label}
        expanded={row.expanded}
        onToggle={() => expansion.toggle(row.path)}
        meta={`${row.count} root${row.count === 1 ? "" : "s"}`}
      />
    )
  }

  if (row.kind === "hidden-indicator") {
    const indentDepth = (row.stickyTop - rowHeight) / rowHeight
    return (
      <div
        className="relative flex h-full w-full items-center"
        style={{ paddingLeft: indentDepth * INDENT }}
      >
        <IndentGuides depth={indentDepth} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => reveal.toggle(row.togglePath)}
          className="h-auto w-fit justify-start px-3 py-1 text-xs font-normal text-muted-foreground italic"
        >
          {row.revealed
            ? `Hide ${row.count} filtered`
            : `${row.count} hidden by filter`}
        </Button>
      </div>
    )
  }

  return (
    <TraceItem
      row={row}
      direction={direction}
      settings={settings}
      selectedId={selectedId}
      onSelect={onSelect}
      expansion={expansion}
    />
  )
}

function TraceItem({
  row,
  direction,
  settings,
  selectedId,
  onSelect,
  expansion,
}: {
  row: Extract<FlatRow, { kind: "trace-row" }>
  direction: Direction
  settings: Settings
  selectedId: NodeId | null
  onSelect: (id: NodeId) => void
  expansion: ExpansionApi
}) {
  const { trace, depth, hasChildren, expanded, domainPrefix } = row
  const followedByMethod = trace.edge
    ? hasMethodOnPeer(trace.edge, direction)
    : false
  const selected = selectedId === trace.id
  const text = ROW_TEXT_BY_FONT[settings.fontSize]

  return (
    <div
      className="relative flex h-full w-full items-center gap-1"
      style={{ paddingLeft: depth * INDENT }}
    >
      <IndentGuides depth={depth} />
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => expansion.toggle(row.path)}
        disabled={!hasChildren}
        aria-expanded={expanded}
        className="shrink-0 text-muted-foreground"
      >
        <CaretRightIcon
          className={`transition-transform ${expanded ? "rotate-90" : ""} ${
            hasChildren ? "" : "opacity-0"
          }`}
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSelect(trace.id)}
        aria-pressed={selected}
        className={`h-auto w-fit justify-start gap-3 px-3 ${text.padY} ${text.main} font-normal ${
          selected ? "bg-muted" : ""
        }`}
      >
        {trace.edge && (
          <EdgeLabel
            edge={trace.edge}
            direction={direction}
            metaClass={text.meta}
          />
        )}
        <NodeBadge kind={trace.node.type} />
        <span>
          <NodeName
            name={trace.node.name}
            kind={trace.node.type}
            domainPrefix={domainPrefix}
            hide={settings.hideDomainPrefix}
            allowEmpty={followedByMethod}
          />
          {trace.edge && (
            <MethodTag
              edge={trace.edge}
              target={trace.node.name}
              direction={direction}
              metaClass={text.meta}
            />
          )}
        </span>
      </Button>
    </div>
  )
}

function IndentGuides({ depth }: { depth: number }) {
  if (depth === 0) return null
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="pointer-events-none absolute top-0 bottom-0 border-l border-border/60"
          style={{ left: 11.5 + i * INDENT }}
        />
      ))}
    </>
  )
}

function hasMethodOnPeer(edge: Edge, direction: Direction): boolean {
  const peer = direction === "forward" ? edge.to : edge.from
  return "method" in peer
}

function EdgeLabel({
  edge,
  direction,
  metaClass,
}: {
  edge: Edge
  direction: Direction
  metaClass: string
}) {
  return (
    <span
      className={`font-mono text-muted-foreground ${metaClass} tracking-wide uppercase`}
    >
      {verbFor(direction, edgeKind(edge))}
    </span>
  )
}

function MethodTag({
  edge,
  target,
  direction,
  metaClass,
}: {
  edge: Edge
  target: string
  direction: Direction
  metaClass: string
}) {
  const peer = direction === "forward" ? edge.to : edge.from
  if ("method" in peer && peer.name === target) {
    return (
      <span className={`font-mono text-muted-foreground ${metaClass}`}>
        .{peer.method}
      </span>
    )
  }
  return null
}
