import type { Node } from "./node";
import { nodeId, type NodeId } from "./graph";

export interface NodeDomain {
  key: string;
  label: string;
}

export function computeDomains(nodes: Node[]): Map<NodeId, NodeDomain> {
  const chains = buildFolderChains(nodes);
  const segmentCounts = countLastSegments(chains);
  const picks = pickUniqueFolders(nodes, chains, segmentCounts);
  const labels = labelDomains([...new Set(picks.values())]);
  return mergeIntoDomains(picks, labels);
}

export interface DomainGroup {
  domain: NodeDomain;
  rootIds: NodeId[];
}

export function domainPrefixFromLabel(label: string): string {
  if (!label || label === "·") return "";
  return label.replace(/\s+/g, "");
}

export type StripPosition = "prefix" | "suffix" | null;

export interface StripResult {
  stripped: string;
  position: StripPosition;
}

export function isJustKind(text: string, kind: string): boolean {
  return text.toLowerCase() === kind.toLowerCase();
}

export function stripDomainAffix(
  name: string,
  affix: string,
  allowEmpty = false,
): StripResult {
  const asPrefix = tryStripPrefix(name, affix, allowEmpty);
  if (asPrefix !== null) return { stripped: asPrefix, position: "prefix" };
  const asSuffix = tryStripSuffix(name, affix, allowEmpty);
  if (asSuffix !== null) return { stripped: asSuffix, position: "suffix" };
  return { stripped: name, position: null };
}

function tryStripPrefix(name: string, affix: string, allowEmpty: boolean): string | null {
  if (!affix) return null;
  if (!name.startsWith(affix)) return null;
  if (name.length === affix.length) return allowEmpty ? "" : null;
  const next = name[affix.length];
  if (next !== next.toUpperCase()) return null;
  return name.slice(affix.length);
}

function tryStripSuffix(name: string, affix: string, allowEmpty: boolean): string | null {
  if (!affix) return null;
  if (!name.endsWith(affix)) return null;
  if (name.length === affix.length) return allowEmpty ? "" : null;
  const prev = name[name.length - affix.length - 1];
  if (prev !== prev.toLowerCase()) return null;
  return name.slice(0, name.length - affix.length);
}

export function groupByDomain(
  rootIds: NodeId[],
  domains: ReadonlyMap<NodeId, NodeDomain>,
): DomainGroup[] {
  const groups = new Map<string, DomainGroup>();
  for (const id of rootIds) {
    const domain = domains.get(id) ?? { key: "·", label: "·" };
    const existing = groups.get(domain.key);
    if (existing) existing.rootIds.push(id);
    else groups.set(domain.key, { domain, rootIds: [id] });
  }
  return [...groups.values()].sort((a, b) =>
    a.domain.label.localeCompare(b.domain.label),
  );
}

function buildFolderChains(nodes: Node[]): Map<NodeId, string[]> {
  const chains = new Map<NodeId, string[]>();
  for (const n of nodes) {
    chains.set(nodeId(n.type, n.name), folderChain(folderOf(n.source.file)));
  }
  return chains;
}

function countLastSegments(chains: Map<NodeId, string[]>): Map<string, number> {
  const unique = new Set<string>();
  for (const chain of chains.values()) for (const f of chain) unique.add(f);

  const counts = new Map<string, number>();
  for (const folder of unique) {
    const seg = lastSegment(folder);
    if (seg) counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }
  return counts;
}

function pickUniqueFolders(
  nodes: Node[],
  chains: Map<NodeId, string[]>,
  segmentCounts: Map<string, number>,
): Map<NodeId, string> {
  const picks = new Map<NodeId, string>();
  for (const n of nodes) {
    const id = nodeId(n.type, n.name);
    const chain = chains.get(id) ?? [];
    picks.set(id, pickDeepestUniqueFolder(chain, segmentCounts));
  }
  return picks;
}

function pickDeepestUniqueFolder(
  chain: string[],
  segmentCounts: Map<string, number>,
): string {
  for (const folder of chain) {
    const seg = lastSegment(folder);
    if (seg && (segmentCounts.get(seg) ?? 0) === 1) return folder;
  }
  return chain[0] ?? "";
}

function labelDomains(paths: string[]): Map<string, string> {
  const segmentsByPath = new Map<string, string[]>();
  for (const p of paths) segmentsByPath.set(p, p.split("/").filter(Boolean));

  const labels = new Map<string, string>();
  for (const path of paths) {
    const segments = segmentsByPath.get(path) ?? [];
    labels.set(path, humanCase(disambiguatedSegment(segments, segmentsByPath)));
  }
  return labels;
}

function disambiguatedSegment(
  segments: string[],
  segmentsByPath: Map<string, string[]>,
): string {
  if (segments.length === 0) return "";
  for (let depth = 1; depth <= segments.length; depth++) {
    const suffix = segments.slice(segments.length - depth).join("/");
    if (countSuffixMatches(suffix, depth, segmentsByPath) === 1) {
      return segments[segments.length - depth];
    }
  }
  return segments[segments.length - 1];
}

function countSuffixMatches(
  suffix: string,
  depth: number,
  segmentsByPath: Map<string, string[]>,
): number {
  let count = 0;
  for (const segments of segmentsByPath.values()) {
    if (segments.length < depth) continue;
    if (segments.slice(segments.length - depth).join("/") === suffix) count++;
  }
  return count;
}

function mergeIntoDomains(
  picks: Map<NodeId, string>,
  labels: Map<string, string>,
): Map<NodeId, NodeDomain> {
  const out = new Map<NodeId, NodeDomain>();
  for (const [id, key] of picks) {
    out.set(id, { key, label: labels.get(key) || "·" });
  }
  return out;
}

function folderOf(file: string): string {
  const parts = file.split(/[\\/]/).filter((s) => s && s !== ".");
  parts.pop();
  return parts.join("/");
}

function folderChain(folder: string): string[] {
  if (!folder) return [];
  const parts = folder.split("/");
  const chain: string[] = [];
  for (let depth = parts.length; depth > 0; depth--) {
    chain.push(parts.slice(0, depth).join("/"));
  }
  return chain;
}

function lastSegment(folder: string): string | undefined {
  return folder.split("/").filter(Boolean).pop();
}

function humanCase(name: string): string {
  return name
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
