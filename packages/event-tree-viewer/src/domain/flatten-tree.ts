import type { GraphIndex, NodeId } from "./graph";
import type { TraceNode } from "./traversal";
import { traceFrom } from "./traversal";
import type { Direction } from "./direction";
import { domainPrefixFromLabel, type DomainGroup } from "./domain-grouping";

export type FlatRow = DomainHeaderRow | TraceRowItem | HiddenIndicatorRow;

export interface DomainHeaderRow {
  kind: "domain-header";
  path: string;
  ancestors: readonly number[];
  stickable: true;
  stickyTop: number;
  subtreeSize: number;
  label: string;
  count: number;
  expanded: boolean;
}

export interface TraceRowItem {
  kind: "trace-row";
  path: string;
  ancestors: readonly number[];
  stickable: boolean;
  stickyTop: number;
  subtreeSize: number;
  depth: number;
  trace: TraceNode;
  domainPrefix: string;
  hasChildren: boolean;
  expanded: boolean;
}

export interface HiddenIndicatorRow {
  kind: "hidden-indicator";
  path: string;
  ancestors: readonly number[];
  stickable: false;
  stickyTop: number;
  count: number;
  revealed: boolean;
  togglePath: string;
}

export interface FlattenInput {
  index: GraphIndex;
  groups: DomainGroup[];
  direction: Direction;
  visibleIds: ReadonlySet<NodeId>;
  isExpanded: (path: string) => boolean;
  isRevealed: (path: string) => boolean;
  headerHeight: number;
  rowHeight: number;
}

export function flattenTree(input: FlattenInput): FlatRow[] {
  const out: FlatRow[] = [];
  for (const group of input.groups) emitGroup(group, input, out);
  return out;
}

function emitGroup(group: DomainGroup, input: FlattenInput, out: FlatRow[]) {
  const sectionPath = `domain:${group.domain.key}`;
  const expanded = input.isExpanded(sectionPath);
  const traces = group.rootIds
    .map((id) => traceFrom(input.index, id, input.direction))
    .filter((t): t is TraceNode => t !== null);

  const headerIndex = out.length;
  out.push({
    kind: "domain-header",
    path: sectionPath,
    ancestors: [],
    stickable: true,
    stickyTop: 0,
    subtreeSize: 1,
    label: group.domain.label,
    count: traces.length,
    expanded,
  });

  if (!expanded) return;

  const domainPrefix = domainPrefixFromLabel(group.domain.label);
  const rootAncestors: readonly number[] = [headerIndex];
  for (const trace of traces) {
    emitTrace(
      trace,
      `${group.domain.key}/${trace.id}`,
      0,
      rootAncestors,
      domainPrefix,
      input,
      out,
    );
  }

  (out[headerIndex] as DomainHeaderRow).subtreeSize = out.length - headerIndex;
}

function emitTrace(
  trace: TraceNode,
  path: string,
  depth: number,
  ancestors: readonly number[],
  domainPrefix: string,
  input: FlattenInput,
  out: FlatRow[],
) {
  const expanded = input.isExpanded(path);
  const hasChildren = trace.children.length > 0;
  const stickable = hasChildren && expanded;
  const stickyTop = input.headerHeight + depth * input.rowHeight;
  const rowIndex = out.length;

  out.push({
    kind: "trace-row",
    path,
    ancestors,
    stickable,
    stickyTop,
    subtreeSize: 1,
    depth,
    trace,
    domainPrefix,
    hasChildren,
    expanded,
  });

  if (!stickable) return;

  const visibleChildren = trace.children.filter((c) => input.visibleIds.has(c.id));
  const revealed = input.isRevealed(path);
  const childrenToRender = revealed ? trace.children : visibleChildren;
  const childAncestors: readonly number[] = [...ancestors, rowIndex];

  childrenToRender.forEach((child, idx) => {
    emitTrace(
      child,
      `${path}/${child.id}:${idx}`,
      depth + 1,
      childAncestors,
      domainPrefix,
      input,
      out,
    );
  });

  const hiddenCount = trace.children.length - visibleChildren.length;
  if (hiddenCount > 0) {
    out.push({
      kind: "hidden-indicator",
      path: `${path}#hidden`,
      ancestors: childAncestors,
      stickable: false,
      stickyTop: input.headerHeight + (depth + 1) * input.rowHeight,
      count: hiddenCount,
      revealed,
      togglePath: path,
    });
  }

  (out[rowIndex] as TraceRowItem).subtreeSize = out.length - rowIndex;
}
