import { useMemo } from "react";
import { CaretRight, DotsThreeIcon } from "@phosphor-icons/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { NodeBadge } from "@/components/node-badge";
import { type GraphIndex, type NodeId } from "@/domain/graph";
import type { Node } from "@/domain/node";
import { traceFrom, type TraceNode } from "@/domain/traversal";
import { edgeKind, verbFor, type Edge } from "@/domain/edge";
import { effectiveRoots } from "@/domain/roots";
import type { Direction } from "@/domain/direction";
import {
  groupByDomain,
  domainPrefixFromLabel,
  stripDomainAffix,
  isJustKind,
  type DomainGroup,
} from "@/domain/domain-grouping";
import { useExpansion, type ExpansionApi } from "@/application/use-expansion";
import { useReveal, type RevealApi } from "@/application/use-reveal";
import type { DomainMap } from "@/application/use-domains";
import type { Settings } from "@/application/use-settings";

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

  const expansion = useExpansion();
  const reveal = useReveal();

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 px-6 py-4">
        {groups.length === 0 && (
          <p className="text-muted-foreground text-sm">No matching roots.</p>
        )}
        {groups.map((group) => (
          <DomainSection
            key={group.domain.key}
            group={group}
            index={index}
            direction={direction}
            settings={settings}
            visibleIds={visibleIds}
            selectedId={selectedId}
            onSelect={onSelect}
            expansion={expansion}
            reveal={reveal}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function DomainSection({
  group,
  index,
  direction,
  settings,
  visibleIds,
  selectedId,
  onSelect,
  expansion,
  reveal,
}: {
  group: DomainGroup;
  index: GraphIndex;
  direction: Direction;
  settings: Settings;
  visibleIds: ReadonlySet<NodeId>;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  expansion: ExpansionApi;
  reveal: RevealApi;
}) {
  const traces = useMemo(
    () =>
      group.rootIds
        .map((id) => traceFrom(index, id, direction))
        .filter((t): t is TraceNode => t !== null),
    [group.rootIds, index, direction],
  );

  const prefix = useMemo(
    () => domainPrefixFromLabel(group.domain.label),
    [group.domain.label],
  );

  return (
    <section className="flex flex-col gap-2">
      <DomainHeader label={group.domain.label} count={traces.length} />
      <div className="flex flex-col gap-1">
        {traces.map((trace) => (
          <TraceBranch
            key={trace.id}
            trace={trace}
            path={`${group.domain.key}/${trace.id}`}
            direction={direction}
            domainPrefix={prefix}
            settings={settings}
            visibleIds={visibleIds}
            selectedId={selectedId}
            onSelect={onSelect}
            expansion={expansion}
            reveal={reveal}
          />
        ))}
      </div>
    </section>
  );
}

function DomainHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="text-muted-foreground flex items-baseline gap-2 text-xs font-semibold tracking-wide uppercase">
      <span>{label}</span>
      <span className="font-mono font-normal">
        {count} root{count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function TraceBranch({
  trace,
  path,
  direction,
  domainPrefix,
  settings,
  visibleIds,
  selectedId,
  onSelect,
  expansion,
  reveal,
}: {
  trace: TraceNode;
  path: string;
  direction: Direction;
  domainPrefix: string;
  settings: Settings;
  visibleIds: ReadonlySet<NodeId>;
  selectedId: NodeId | null;
  onSelect: (id: NodeId) => void;
  expansion: ExpansionApi;
  reveal: RevealApi;
}) {
  const hasChildren = trace.children.length > 0;
  const expanded = expansion.isExpanded(path);
  const revealed = reveal.isRevealed(path);

  const visibleChildren = useMemo(
    () => trace.children.filter((c) => visibleIds.has(c.id)),
    [trace.children, visibleIds],
  );
  const hiddenCount = trace.children.length - visibleChildren.length;
  const childrenToRender = revealed ? trace.children : visibleChildren;

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
          domainPrefix={domainPrefix}
          settings={settings}
          selected={selectedId === trace.id}
          onSelect={onSelect}
        />
      </div>
      {hasChildren && expanded && (
        <div className="border-border/60 ml-[11.5px] flex flex-col gap-1 border-l pt-1 pl-[19.5px]">
          {childrenToRender.map((child, idx) => (
            <TraceBranch
              key={`${child.id}:${idx}`}
              trace={child}
              path={`${path}/${child.id}:${idx}`}
              direction={direction}
              domainPrefix={domainPrefix}
              settings={settings}
              visibleIds={visibleIds}
              selectedId={selectedId}
              onSelect={onSelect}
              expansion={expansion}
              reveal={reveal}
            />
          ))}
          {hiddenCount > 0 && (
            <HiddenIndicator
              count={hiddenCount}
              revealed={revealed}
              onToggle={() => reveal.toggle(path)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HiddenIndicator({
  count,
  revealed,
  onToggle,
}: {
  count: number;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="text-muted-foreground h-auto w-fit justify-start px-3 py-1 text-xs font-normal italic"
    >
      {revealed ? `Hide ${count} filtered` : `${count} hidden by filter`}
    </Button>
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
  domainPrefix,
  settings,
  selected,
  onSelect,
}: {
  trace: TraceNode;
  direction: Direction;
  domainPrefix: string;
  settings: Settings;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  const followedByMethod = trace.edge ? hasMethodOnPeer(trace.edge, direction) : false;

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
