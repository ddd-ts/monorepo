import type { ReactNode } from "react";

export interface DomainColor {
  /** Strong color for a label sitting on a white background. */
  text: string;
  /** Tinted background (very light) usable behind the label or as a chip. */
  bg: string;
  /** Solid color for a small dot/swatch indicator. */
  dot: string;
}

// Curated palette of OKLCH hues. We hash the domain key to one of these so
// the same domain always gets the same color, but every domain pulls from a
// visually-coherent set rather than the full hue wheel.
const DOMAIN_HUES = [250, 30, 145, 320, 200, 60, 290, 0, 175, 105];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

const DOMAIN_CACHE = new Map<string, DomainColor>();

export function domainColor(key: string): DomainColor {
  const cached = DOMAIN_CACHE.get(key);
  if (cached) return cached;
  const hue = DOMAIN_HUES[hashKey(key) % DOMAIN_HUES.length];
  const color: DomainColor = {
    text: `oklch(0.5 0.13 ${hue})`,
    bg: `oklch(0.96 0.035 ${hue})`,
    dot: `oklch(0.62 0.16 ${hue})`,
  };
  DOMAIN_CACHE.set(key, color);
  return color;
}

// Semantic keyword colors. Each entry maps a CamelCase / lowercase word to a
// color logical to its meaning (creation = green, destruction = red, etc.).
// Lookup is case-insensitive.
const KEYWORD_COLORS: Record<string, string> = {
  created: "oklch(0.5 0.16 145)",
  initialized: "oklch(0.5 0.16 145)",
  enabled: "oklch(0.55 0.16 175)",
  disabled: "oklch(0.6 0.16 60)",
  deleted: "oklch(0.55 0.18 25)",
};

/**
 * Split a name into segments while preserving every character — CamelCase
 * runs (`[A-Z][a-z0-9]*`), lowercase runs, and any separator (`_`, `-`, `.`,
 * spaces) all become individual segments. Joining them back yields the
 * original string.
 */
function segmentName(name: string): string[] {
  const segments: string[] = [];
  const re = /[A-Z][a-z0-9]*|[a-z0-9]+|[^A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name)) !== null) segments.push(m[0]);
  return segments.length ? segments : [name];
}

export interface DomainInfo {
  key: string;
  label: string;
}

/**
 * Find the indices of segments whose joined lowercase form equals the
 * domain label's joined lowercase form. Handles multi-word domain labels
 * (e.g. label "User Account" matches consecutive "User", "Account" segments
 * in "UserAccountCreated").
 */
function findDomainSegmentIndices(
  segments: string[],
  domainLabel: string,
): Set<number> {
  const out = new Set<number>();
  const target = domainLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!target) return out;
  // Word-segment positions: indices into `segments` that are alphanumeric
  // (skipping pure-separator runs).
  const wordPositions: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (/[A-Za-z0-9]/.test(segments[i])) wordPositions.push(i);
  }
  for (let start = 0; start < wordPositions.length; start++) {
    let joined = "";
    for (let end = start; end < wordPositions.length; end++) {
      joined += segments[wordPositions[end]].toLowerCase();
      if (joined.length > target.length) break;
      if (joined === target) {
        for (let k = start; k <= end; k++) out.add(wordPositions[k]);
        return out;
      }
    }
  }
  return out;
}

/**
 * Render a name with semantic keyword segments highlighted. When `domain`
 * is provided, segments matching the domain label are colored with the
 * deterministic per-domain color. Keywords ("Created", "Deleted", …) carry
 * a logical color regardless of domain.
 */
export function colorizeName(
  name: string,
  domain?: DomainInfo,
): ReactNode[] {
  const segments = segmentName(name);
  const domainIndices = domain
    ? findDomainSegmentIndices(segments, domain.label)
    : null;
  const dColor = domain ? domainColor(domain.key).text : null;

  return segments.map((seg, i) => {
    const keywordCol = KEYWORD_COLORS[seg.toLowerCase()];
    if (keywordCol) {
      return (
        <span key={i} style={{ color: keywordCol, fontWeight: 600 }}>
          {seg}
        </span>
      );
    }
    if (dColor && domainIndices?.has(i)) {
      return (
        <span key={i} style={{ color: dColor, fontWeight: 600 }}>
          {seg}
        </span>
      );
    }
    return <span key={i}>{seg}</span>;
  });
}
