import { memo, useCallback, useMemo, useRef } from "react";
import { CaretRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import {
  defaultRangeExtractor,
  useVirtualizer,
  type Range,
} from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { NodeBadge } from "@/components/node-badge";
import { type GraphIndex, type NodeId } from "@/domain/graph";
import type { Node } from "@/domain/node";
import { edgeKind, verbFor, type Edge } from "@/domain/edge";
import { effectiveRoots } from "@/domain/roots";
import type { Direction } from "@/domain/direction";
import {
  groupByDomain,
  stripDomainAffix,
  isJustKind,
} from "@/domain/domain-grouping";
import { flattenTree, type FlatRow } from "@/domain/flatten-tree";
import { useExpansion, type ExpansionApi } from "@/application/use-expansion";
import { useReveal, type RevealApi } from "@/application/use-reveal";
import type { DomainMap } from "@/application/use-domains";
import type { Settings } from "@/application/use-settings";

const HEADER_H = 36;
const ROW_H = 36;
const INDENT = 31;
const HEADER_Z = 40;
const ROW_Z_BASE = 30;
const STICKY_BOTTOM_CLASSES =
  "after:bg-border after:pointer-events-none after:absolute after:bottom-[-1px] after:left-[-9999px] after:right-[-9999px] after:h-px after:content-['']";

interface TreeViewProps {
  index: GraphIndex;
  visibleNodes: Node[];
  domains: DomainMap;
  direction: Direction;
  settings: Settings;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
}

export function TreeView({
  index,
  visibleNodes,
  domains,
  direction,
  settings,
  selectedId,
  onSelect,
}: TreeViewProps) {
  const expansion = useExpansion();
  const reveal = useReveal();

  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((n) => `${n.type}:${n.name}` as NodeId)),
    [visibleNodes],
  );

  const groups = useMemo(() => {
    const visibleRoots = effectiveRoots(index, direction).filter((id) =>
      visibleIds.has(id),
    );
    return groupByDomain(visibleRoots, domains);
  }, [index, direction, visibleIds, domains]);

  const rows = useMemo(
    () =>
      flattenTree({
        index,
        groups,
        direction,
        visibleIds,
        isExpanded: expansion.isExpanded,
        isRevealed: reveal.isRevealed,
        headerHeight: HEADER_H,
        rowHeight: ROW_H,
      }),
    [index, groups, direction, visibleIds, expansion, reveal],
  );

  const parentRef = useRef<HTMLDivElement>(null);

  const rangeExtractor = useCallback(
    (range: Range) => {
      const first = rows[range.startIndex];
      const ancestors = first?.ancestors ?? [];
      const set = new Set<number>([...ancestors, ...defaultRangeExtractor(range)]);
      return [...set].sort((a, b) => a - b);
    },
    [rows],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      parentRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
    rangeExtractor,
  });

  const scrollOffset = virtualizer.scrollOffset ?? 0;
  const virtualItems = virtualizer.getVirtualItems();
  let pinnedBottomPath: string | null = null;
  let deepestStickyTop = -1;
  for (const item of virtualItems) {
    const row = rows[item.index];
    if (!row.stickable) continue;
    const enter = item.start - row.stickyTop;
    const exit = item.start + row.subtreeSize * ROW_H - row.stickyTop - ROW_H;
    if (scrollOffset >= enter && scrollOffset < exit) {
      if (row.stickyTop > deepestStickyTop) {
        deepestStickyTop = row.stickyTop;
        pinnedBottomPath = row.path;
      }
    }
  }

  return (
    <ScrollArea ref={parentRef} className="h-full">
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-6 py-4 text-sm">No matching roots.</p>
      ) : (
        <div className="overflow-x-clip px-6 pb-4">
          <div
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((virtualRow) => (
              <FlatRowSlot
                key={virtualRow.key}
                row={rows[virtualRow.index]}
                naturalY={virtualRow.start}
                size={virtualRow.size}
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
      )}
    </ScrollArea>
  );
}

interface FlatRowSlotProps {
  row: FlatRow;
  naturalY: number;
  size: number;
  isPinnedBottom: boolean;
  direction: Direction;
  settings: Settings;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  expansion: ExpansionApi;
  reveal: RevealApi;
}

const FlatRowSlot = memo(function FlatRowSlot({
  row,
  naturalY,
  size,
  isPinnedBottom,
  direction,
  settings,
  selectedId,
  onSelect,
  expansion,
  reveal,
}: FlatRowSlotProps) {
  const depth = row.kind === "trace-row" ? row.depth : 0;
  const zIndex = row.stickable
    ? row.kind === "domain-header"
      ? HEADER_Z
      : ROW_Z_BASE - depth
    : 0;

  if (row.stickable) {
    return (
      <div
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: naturalY,
          height: row.subtreeSize * ROW_H,
          zIndex,
        }}
      >
        <div
          className={`bg-background pointer-events-auto sticky flex w-full items-center ${
            isPinnedBottom ? STICKY_BOTTOM_CLASSES : ""
          }`}
          style={{ top: row.stickyTop, minHeight: size }}
        >
          <RowContent
            row={row}
            direction={direction}
            settings={settings}
            selectedId={selectedId}
            onSelect={onSelect}
            expansion={expansion}
            reveal={reveal}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-background absolute left-0 right-0 flex items-center"
      style={{
        top: naturalY,
        minHeight: size,
        zIndex,
      }}
    >
      <RowContent
        row={row}
        direction={direction}
        settings={settings}
        selectedId={selectedId}
        onSelect={onSelect}
        expansion={expansion}
        reveal={reveal}
      />
    </div>
  );
});

function RowContent({
  row,
  direction,
  settings,
  selectedId,
  onSelect,
  expansion,
  reveal,
}: {
  row: FlatRow;
  direction: Direction;
  settings: Settings;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  expansion: ExpansionApi;
  reveal: RevealApi;
}) {
  if (row.kind === "domain-header") {
    return (
      <button
        type="button"
        onClick={() => expansion.toggle(row.path)}
        className="hover:bg-muted/30 flex h-full w-full items-center gap-2 px-1 py-2 text-left transition-colors"
      >
        <CaretRightIcon
          className={`text-muted-foreground size-3 shrink-0 transition-transform ${
            row.expanded ? "rotate-90" : ""
          }`}
        />
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {row.label}
        </span>
        <span className="text-muted-foreground font-mono text-xs font-normal">
          {row.count} root{row.count === 1 ? "" : "s"}
        </span>
      </button>
    );
  }

  if (row.kind === "hidden-indicator") {
    const indentDepth = (row.stickyTop - HEADER_H) / ROW_H;
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
          className="text-muted-foreground h-auto w-fit justify-start px-3 py-1 text-xs font-normal italic"
        >
          {row.revealed
            ? `Hide ${row.count} filtered`
            : `${row.count} hidden by filter`}
        </Button>
      </div>
    );
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
  );
}

function TraceItem({
  row,
  direction,
  settings,
  selectedId,
  onSelect,
  expansion,
}: {
  row: Extract<FlatRow, { kind: "trace-row" }>;
  direction: Direction;
  settings: Settings;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  expansion: ExpansionApi;
}) {
  const { trace, depth, hasChildren, expanded, domainPrefix } = row;
  const followedByMethod = trace.edge ? hasMethodOnPeer(trace.edge, direction) : false;
  const selected = selectedId === trace.id;

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
        className="text-muted-foreground shrink-0"
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
        className={`h-auto w-fit justify-start gap-3 px-3 py-1.5 text-sm font-normal ${
          selected ? "bg-muted" : ""
        }`}
      >
        {trace.edge && <EdgeLabel edge={trace.edge} direction={direction} />}
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
            <MethodTag edge={trace.edge} target={trace.node.name} direction={direction} />
          )}
        </span>
      </Button>
    </div>
  );
}

function IndentGuides({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="border-border/60 pointer-events-none absolute top-0 bottom-0 border-l"
          style={{ left: 11.5 + i * INDENT }}
        />
      ))}
    </>
  );
}

function hasMethodOnPeer(edge: Edge, direction: Direction): boolean {
  const peer = direction === "forward" ? edge.to : edge.from;
  return "method" in peer;
}

function NodeName({
  name,
  kind,
  domainPrefix,
  hide,
  allowEmpty,
}: {
  name: string;
  kind: string;
  domainPrefix: string;
  hide: boolean;
  allowEmpty: boolean;
}) {
  if (!hide) return <span className="font-medium">{name}</span>;
  const { stripped, position } = stripDomainAffix(name, domainPrefix, allowEmpty);
  if (position === null) return <span className="font-medium">{name}</span>;
  const visible = isJustKind(stripped, kind) ? "" : stripped;
  const ellipsis = (
    <DotsThreeIcon
      className="text-muted-foreground inline size-3 align-middle"
      aria-label={name}
    />
  );
  return (
    <span className="font-medium" title={name}>
      {position === "prefix" && ellipsis}
      {visible}
      {position === "suffix" && ellipsis}
    </span>
  );
}

function EdgeLabel({ edge, direction }: { edge: Edge; direction: Direction }) {
  return (
    <span className="text-muted-foreground font-mono text-xs tracking-wide uppercase">
      {verbFor(direction, edgeKind(edge))}
    </span>
  );
}

function MethodTag({
  edge,
  target,
  direction,
}: {
  edge: Edge;
  target: string;
  direction: Direction;
}) {
  const peer = direction === "forward" ? edge.to : edge.from;
  if ("method" in peer && peer.name === target) {
    return <span className="text-muted-foreground font-mono text-xs">.{peer.method}</span>;
  }
  return null;
}
