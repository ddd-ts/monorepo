import { useMemo } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { NodeBadge } from "@/components/node-badge";
import { type GraphIndex, type NodeId } from "@/domain/graph";
import type { Node } from "@/domain/node";
import { traceFrom, type TraceNode } from "@/domain/traversal";
import { edgeKind, verbFor, type Edge } from "@/domain/edge";
import { effectiveRoots } from "@/domain/roots";
import type { Direction } from "@/domain/direction";
import { useExpansion, type ExpansionApi } from "@/application/use-expansion";

interface TreeViewProps {
  index: GraphIndex;
  visibleNodes: Node[];
  direction: Direction;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
}

export function TreeView({
  index,
  visibleNodes,
  direction,
  selectedId,
  onSelect,
}: TreeViewProps) {
  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((n) => `${n.type}:${n.name}` as NodeId)),
    [visibleNodes],
  );

  const roots = useMemo(() => {
    return effectiveRoots(index, direction)
      .filter((id) => visibleIds.has(id))
      .map((id) => traceFrom(index, id, direction))
      .filter((t): t is TraceNode => t !== null);
  }, [index, direction, visibleIds]);

  const expansion = useExpansion();

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 px-6 py-4">
        {roots.length === 0 && (
          <p className="text-muted-foreground text-sm">No matching roots.</p>
        )}
        {roots.map((trace) => (
          <TraceBranch
            key={trace.id}
            trace={trace}
            path={trace.id}
            direction={direction}
            selectedId={selectedId}
            onSelect={onSelect}
            expansion={expansion}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function TraceBranch({
  trace,
  path,
  direction,
  selectedId,
  onSelect,
  expansion,
}: {
  trace: TraceNode;
  path: string;
  direction: Direction;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  expansion: ExpansionApi;
}) {
  const hasChildren = trace.children.length > 0;
  const expanded = expansion.isExpanded(path);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1">
        <ExpandToggle
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={() => expansion.toggle(path)}
        />
        <TraceRow
          trace={trace}
          direction={direction}
          selected={selectedId === trace.id}
          onSelect={onSelect}
        />
      </div>
      {hasChildren && expanded && (
        <div className="border-border/60 ml-[11.5px] flex flex-col gap-1 border-l pt-1 pl-[19.5px]">
          {trace.children.map((child, idx) => (
            <TraceBranch
              key={`${child.id}:${idx}`}
              trace={child}
              path={`${path}/${child.id}:${idx}`}
              direction={direction}
              selectedId={selectedId}
              onSelect={onSelect}
              expansion={expansion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandToggle({
  hasChildren,
  expanded,
  onToggle,
}: {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onToggle}
      disabled={!hasChildren}
      aria-expanded={expanded}
      className="text-muted-foreground shrink-0"
    >
      <CaretRight
        className={`transition-transform ${expanded ? "rotate-90" : ""} ${
          hasChildren ? "" : "opacity-0"
        }`}
      />
    </Button>
  );
}

function TraceRow({
  trace,
  direction,
  selected,
  onSelect,
}: {
  trace: TraceNode;
  direction: Direction;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  return (
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
        <span className="font-medium">{trace.node.name}</span>
        {trace.edge && (
          <MethodTag edge={trace.edge} target={trace.node.name} direction={direction} />
        )}
      </span>
    </Button>
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
